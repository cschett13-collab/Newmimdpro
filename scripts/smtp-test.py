#!/usr/bin/env python3
"""
smtp-test.py — verify SMTP creds before booting the dispatcher.

Reads SMTP_HOST/PORT/USER/PASSWORD and DISPATCHER_FROM_* from the
environment (or from `.env` in the current directory), then sends one
test message to the recipient passed on the command line. Exits 0 on
success and prints the SMTP server's response so deliverability issues
are obvious.

Usage:
    scripts/smtp-test.py you@gmail.com
    scripts/smtp-test.py you@gmail.com --env path/to/.env
"""

from __future__ import annotations

import argparse
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from pathlib import Path


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def main() -> int:
    parser = argparse.ArgumentParser(description="One-shot SMTP test send.")
    parser.add_argument("recipient", help="Address to deliver the test message to.")
    parser.add_argument(
        "--env",
        default=".env",
        help="Path to a .env file to read defaults from (default: ./.env).",
    )
    parser.add_argument(
        "--subject",
        default="FVCE SMTP deliverability test",
        help="Subject line of the test message.",
    )
    args = parser.parse_args()

    load_env_file(Path(args.env))

    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    from_name = os.environ.get("DISPATCHER_FROM_NAME", "FVCE Test")
    from_email = os.environ.get("DISPATCHER_FROM_EMAIL", user)
    reply_to = os.environ.get("DISPATCHER_REPLY_TO", from_email)

    missing = [k for k, v in {
        "SMTP_HOST": host, "SMTP_USER": user,
        "SMTP_PASSWORD": password, "DISPATCHER_FROM_EMAIL": from_email,
    }.items() if not v]
    if missing:
        print(f"missing env vars: {', '.join(missing)}", file=sys.stderr)
        print("fill them in .env or export them in this shell.", file=sys.stderr)
        return 2

    msg = EmailMessage()
    msg["Subject"] = args.subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = args.recipient
    msg["Reply-To"] = reply_to
    msg["Message-ID"] = make_msgid(domain=from_email.split("@", 1)[-1])
    msg.set_content(
        "If you can read this, SMTP auth + DKIM/SPF are working.\n\n"
        f"  Host: {host}:{port}\n"
        f"  User: {user}\n"
        f"  From: {from_email}\n"
        "\nSent by scripts/smtp-test.py — safe to delete.\n"
    )

    print(f">>> connecting to {host}:{port} as {user}")
    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.set_debuglevel(1)
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(user, password)
            smtp.send_message(msg)
    except smtplib.SMTPAuthenticationError as e:
        print(f"\nAUTH FAILED: {e.smtp_code} {e.smtp_error!r}", file=sys.stderr)
        print("check: SMTP_USER is postmaster@mg.<domain> and the password matches "
              "the credential shown under Mailgun > Sending > Domain settings > SMTP credentials.",
              file=sys.stderr)
        return 3
    except Exception as e:
        print(f"\nSEND FAILED: {e!r}", file=sys.stderr)
        return 4

    print(f"\n>>> sent. check {args.recipient} (and the spam folder).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
