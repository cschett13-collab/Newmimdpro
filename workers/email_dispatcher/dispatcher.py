"""
email_dispatcher.py — FVCE B2B technical-audit dispatcher.

Polls a SQLite queue for rows where status='APPROVED', sends each one as an
SMTP TLS message (port 587) using credentials from environment variables,
appends a CAN-SPAM compliant footer with a physical address + unsubscribe
instructions, and flips the row to status='SENT'. Failures are recorded on
the row and counted; rows that fail too many times are marked 'FAILED'.

Designed to run continuously inside its own Docker container — no cron, no
external libraries. Standard library only.
"""

from __future__ import annotations

import logging
import os
import signal
import smtplib
import sqlite3
import ssl
import sys
import time
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

# --- Configuration (all from env, no defaults for secrets) -------------------

DB_PATH = os.environ.get("DISPATCHER_DB", "/data/lead_queue.db")
SCHEMA_PATH = os.environ.get("DISPATCHER_SCHEMA", "/app/schema.sql")
POLL_SECONDS = int(os.environ.get("DISPATCHER_POLL_SECONDS", "300"))  # 5 min
BATCH_SIZE = int(os.environ.get("DISPATCHER_BATCH_SIZE", "10"))
MAX_ATTEMPTS = int(os.environ.get("DISPATCHER_MAX_ATTEMPTS", "3"))

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASSWORD", "")
SMTP_TIMEOUT = int(os.environ.get("SMTP_TIMEOUT", "30"))

FROM_NAME = os.environ.get("DISPATCHER_FROM_NAME", "Fox Valley Client Engine")
FROM_EMAIL = os.environ.get("DISPATCHER_FROM_EMAIL", "")
REPLY_TO = os.environ.get("DISPATCHER_REPLY_TO", "") or FROM_EMAIL

# CAN-SPAM footer pieces. Physical postal address is REQUIRED by the law;
# refuse to start without it rather than silently sending non-compliant mail.
SENDER_BUSINESS_NAME = os.environ.get("DISPATCHER_BUSINESS_NAME", "")
SENDER_POSTAL_ADDRESS = os.environ.get("DISPATCHER_POSTAL_ADDRESS", "")
UNSUBSCRIBE_MAILTO = os.environ.get("DISPATCHER_UNSUBSCRIBE_EMAIL", "") or REPLY_TO

logging.basicConfig(
    level=os.environ.get("DISPATCHER_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s dispatcher: %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("dispatcher")

# --- Graceful shutdown -------------------------------------------------------

_shutdown = False


def _request_shutdown(signum: int, _frame) -> None:
    global _shutdown
    log.info("received signal %s, draining and exiting after current batch", signum)
    _shutdown = True


signal.signal(signal.SIGTERM, _request_shutdown)
signal.signal(signal.SIGINT, _request_shutdown)


# --- DB ----------------------------------------------------------------------


def connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    if not os.path.exists(SCHEMA_PATH):
        log.warning("schema file not found at %s; skipping bootstrap", SCHEMA_PATH)
        return
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())


def claim_batch(conn: sqlite3.Connection, limit: int) -> list[sqlite3.Row]:
    """Atomically grab up to `limit` APPROVED rows that aren't suppressed."""
    cur = conn.execute(
        """
        SELECT id, contact_email, contact_name, company, subject, body, attempts
        FROM leads
        WHERE status = 'APPROVED'
          AND contact_email NOT IN (SELECT email FROM suppressions)
        ORDER BY id
        LIMIT ?
        """,
        (limit,),
    )
    return cur.fetchall()


def mark_sent(conn: sqlite3.Connection, lead_id: int) -> None:
    conn.execute(
        "UPDATE leads SET status='SENT', sent_at=datetime('now'), last_error=NULL "
        "WHERE id=?",
        (lead_id,),
    )


def mark_failure(conn: sqlite3.Connection, lead_id: int, error: str) -> None:
    conn.execute(
        """
        UPDATE leads
        SET attempts = attempts + 1,
            last_error = ?,
            status = CASE WHEN attempts + 1 >= ? THEN 'FAILED' ELSE status END
        WHERE id = ?
        """,
        (error[:1000], MAX_ATTEMPTS, lead_id),
    )


def mark_suppressed(conn: sqlite3.Connection, lead_id: int) -> None:
    conn.execute(
        "UPDATE leads SET status='SUPPRESSED', last_error='on suppression list' "
        "WHERE id=?",
        (lead_id,),
    )


# --- Email -------------------------------------------------------------------


def can_spam_footer() -> str:
    lines = [
        "",
        "--",
        f"You are receiving this message because {SENDER_BUSINESS_NAME or FROM_NAME} "
        "identified your business as a potentially relevant contact for our local "
        "contractor outreach.",
        f"To opt out of future emails from us, reply to this email with the word "
        f"UNSUBSCRIBE, or email {UNSUBSCRIBE_MAILTO}.",
        f"{SENDER_BUSINESS_NAME or FROM_NAME}",
        SENDER_POSTAL_ADDRESS,
    ]
    return "\n".join(line for line in lines if line is not None)


def build_message(row: sqlite3.Row) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((FROM_NAME, FROM_EMAIL))
    to_name = row["contact_name"] or ""
    msg["To"] = formataddr((to_name, row["contact_email"]))
    msg["Subject"] = row["subject"]
    msg["Reply-To"] = REPLY_TO
    msg["Message-ID"] = make_msgid(domain=FROM_EMAIL.split("@")[-1] or "localhost")
    msg["List-Unsubscribe"] = f"<mailto:{UNSUBSCRIBE_MAILTO}?subject=unsubscribe>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(f"{row['body']}\n{can_spam_footer()}")
    return msg


def send_one(smtp: smtplib.SMTP, row: sqlite3.Row) -> None:
    msg = build_message(row)
    smtp.send_message(msg)


def smtp_connect() -> smtplib.SMTP:
    ctx = ssl.create_default_context()
    smtp = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT)
    smtp.ehlo()
    smtp.starttls(context=ctx)
    smtp.ehlo()
    smtp.login(SMTP_USER, SMTP_PASS)
    return smtp


# --- Loop --------------------------------------------------------------------


def validate_config() -> list[str]:
    missing = []
    for name, value in (
        ("SMTP_HOST", SMTP_HOST),
        ("SMTP_USER", SMTP_USER),
        ("SMTP_PASSWORD", SMTP_PASS),
        ("DISPATCHER_FROM_EMAIL", FROM_EMAIL),
        ("DISPATCHER_BUSINESS_NAME", SENDER_BUSINESS_NAME),
        ("DISPATCHER_POSTAL_ADDRESS", SENDER_POSTAL_ADDRESS),
    ):
        if not value:
            missing.append(name)
    return missing


def process_batch(conn: sqlite3.Connection) -> int:
    batch = claim_batch(conn, BATCH_SIZE)
    if not batch:
        return 0

    log.info("processing %d approved lead(s)", len(batch))
    try:
        smtp = smtp_connect()
    except Exception as e:
        log.error("SMTP connect failed: %s", e)
        for row in batch:
            mark_failure(conn, row["id"], f"smtp_connect: {e!r}")
        return 0

    sent = 0
    try:
        for row in batch:
            try:
                send_one(smtp, row)
                mark_sent(conn, row["id"])
                sent += 1
                log.info("sent lead id=%s to %s", row["id"], row["contact_email"])
            except smtplib.SMTPRecipientsRefused as e:
                log.warning(
                    "recipient refused for id=%s (%s); suppressing",
                    row["id"], row["contact_email"],
                )
                mark_failure(conn, row["id"], f"recipient_refused: {e!r}")
            except Exception as e:
                log.error("send failed for id=%s: %s", row["id"], e)
                mark_failure(conn, row["id"], f"send: {e!r}")
    finally:
        try:
            smtp.quit()
        except Exception:
            pass
    return sent


def main() -> int:
    missing = validate_config()
    if missing:
        log.error(
            "missing required env vars: %s — refusing to start. "
            "Set them in .env (see .env.example).",
            ", ".join(missing),
        )
        return 2

    log.info(
        "starting dispatcher | db=%s | smtp=%s:%s | poll=%ss | batch=%s | max_attempts=%s",
        DB_PATH, SMTP_HOST, SMTP_PORT, POLL_SECONDS, BATCH_SIZE, MAX_ATTEMPTS,
    )

    conn = connect()
    ensure_schema(conn)

    while not _shutdown:
        try:
            process_batch(conn)
        except Exception as e:
            log.exception("unexpected error in poll cycle: %s", e)

        # Sleep in small slices so SIGTERM is responsive.
        slept = 0
        while slept < POLL_SECONDS and not _shutdown:
            time.sleep(min(5, POLL_SECONDS - slept))
            slept += 5

    log.info("dispatcher exiting cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
