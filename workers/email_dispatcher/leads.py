"""
leads.py — operator CLI for lead_queue.db. Runs inside the dispatcher
container so it shares the same SQLite path and schema.

Usage (from the host, via docker compose):

    docker compose exec dispatcher python /app/leads.py list
    docker compose exec dispatcher python /app/leads.py list --status APPROVED

    docker compose exec dispatcher python /app/leads.py add \\
        --email contact@example.com \\
        --name "Jane Doe" \\
        --company "Acme Roofing" \\
        --subject "Free technical audit for Acme Roofing" \\
        --body-file -    # reads body from stdin

    docker compose exec dispatcher python /app/leads.py approve 42
    docker compose exec dispatcher python /app/leads.py approve --all-pending

    docker compose exec dispatcher python /app/leads.py suppress contact@example.com \\
        --reason "unsubscribed via reply"

    docker compose exec dispatcher python /app/leads.py show 42

Standard library only — same constraint as dispatcher.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from typing import Iterable

DB_PATH = os.environ.get("DISPATCHER_DB", "/data/lead_queue.db")
SCHEMA_PATH = os.environ.get("DISPATCHER_SCHEMA", "/app/schema.sql")

STATUSES = ("PENDING", "APPROVED", "SENT", "FAILED", "SUPPRESSED")


def connect() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        # Bootstrap schema on first run so `add` works on a fresh volume.
        os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=30)
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
        conn.close()
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    return conn


# --- commands ---------------------------------------------------------------


def cmd_list(args: argparse.Namespace) -> int:
    conn = connect()
    sql = (
        "SELECT id, status, contact_email, COALESCE(company,'') AS company, "
        "subject, attempts, created_at, sent_at FROM leads"
    )
    params: list[object] = []
    if args.status:
        sql += " WHERE status = ?"
        params.append(args.status)
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(args.limit)
    rows = list(conn.execute(sql, params))
    if not rows:
        print("(no rows)")
        return 0
    widths = [3, 9, 32, 24, 40, 4]
    headers = ("id", "status", "email", "company", "subject", "tries")
    print("  ".join(h.ljust(w) for h, w in zip(headers, widths)))
    print("  ".join("-" * w for w in widths))
    for r in rows:
        cells = (
            str(r["id"]),
            r["status"],
            (r["contact_email"] or "")[:32],
            (r["company"] or "")[:24],
            (r["subject"] or "")[:40],
            str(r["attempts"]),
        )
        print("  ".join(c.ljust(w) for c, w in zip(cells, widths)))
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    conn = connect()
    row = conn.execute("SELECT * FROM leads WHERE id = ?", (args.id,)).fetchone()
    if not row:
        print(f"no lead with id={args.id}", file=sys.stderr)
        return 1
    print(json.dumps(dict(row), indent=2, default=str))
    return 0


def cmd_add(args: argparse.Namespace) -> int:
    if args.body_file == "-":
        body = sys.stdin.read()
    else:
        with open(args.body_file, "r", encoding="utf-8") as f:
            body = f.read()
    body = body.strip()
    if not body:
        print("body is empty — refusing to insert", file=sys.stderr)
        return 2

    status = "APPROVED" if args.approve else "PENDING"
    conn = connect()
    cur = conn.execute(
        """
        INSERT INTO leads (contact_email, contact_name, company, subject, body, status, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 'APPROVED' THEN datetime('now') ELSE NULL END)
        """,
        (
            args.email.strip().lower(),
            args.name,
            args.company,
            args.subject,
            body,
            status,
            status,
        ),
    )
    print(f"inserted lead id={cur.lastrowid} status={status}")
    return 0


def cmd_approve(args: argparse.Namespace) -> int:
    conn = connect()
    if args.all_pending:
        cur = conn.execute(
            "UPDATE leads SET status='APPROVED', approved_at=datetime('now') "
            "WHERE status='PENDING'"
        )
        print(f"approved {cur.rowcount} pending lead(s)")
        return 0
    if not args.ids:
        print("provide lead id(s) or --all-pending", file=sys.stderr)
        return 2
    cur = conn.execute(
        f"UPDATE leads SET status='APPROVED', approved_at=datetime('now') "
        f"WHERE id IN ({_placeholders(args.ids)}) AND status='PENDING'",
        args.ids,
    )
    print(f"approved {cur.rowcount} lead(s)")
    return 0


def cmd_suppress(args: argparse.Namespace) -> int:
    email = args.email.strip().lower()
    conn = connect()
    conn.execute(
        "INSERT OR REPLACE INTO suppressions (email, reason) VALUES (?, ?)",
        (email, args.reason),
    )
    cur = conn.execute(
        "UPDATE leads SET status='SUPPRESSED' WHERE contact_email=? AND status IN ('PENDING','APPROVED')",
        (email,),
    )
    print(f"suppressed {email}; cancelled {cur.rowcount} pending/approved lead(s)")
    return 0


def cmd_reset(args: argparse.Namespace) -> int:
    """Re-queue a FAILED lead for another shot."""
    conn = connect()
    cur = conn.execute(
        f"UPDATE leads SET status='APPROVED', attempts=0, last_error=NULL "
        f"WHERE id IN ({_placeholders(args.ids)}) AND status='FAILED'",
        args.ids,
    )
    print(f"re-queued {cur.rowcount} failed lead(s)")
    return 0


def _placeholders(items: Iterable[object]) -> str:
    return ",".join("?" for _ in items)


# --- argparse ---------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="leads", description="Manage lead_queue.db")
    sub = p.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("list", help="list recent leads")
    pl.add_argument("--status", choices=STATUSES)
    pl.add_argument("--limit", type=int, default=50)
    pl.set_defaults(func=cmd_list)

    ps = sub.add_parser("show", help="show one lead as JSON")
    ps.add_argument("id", type=int)
    ps.set_defaults(func=cmd_show)

    pa = sub.add_parser("add", help="insert a new lead")
    pa.add_argument("--email", required=True)
    pa.add_argument("--name")
    pa.add_argument("--company")
    pa.add_argument("--subject", required=True)
    pa.add_argument(
        "--body-file",
        default="-",
        help="file path containing email body, or '-' for stdin (default)",
    )
    pa.add_argument(
        "--approve",
        action="store_true",
        help="insert directly as APPROVED instead of PENDING",
    )
    pa.set_defaults(func=cmd_add)

    pap = sub.add_parser("approve", help="approve pending leads")
    pap.add_argument("ids", nargs="*", type=int)
    pap.add_argument("--all-pending", action="store_true")
    pap.set_defaults(func=cmd_approve)

    psu = sub.add_parser("suppress", help="suppress a contact email (opt-out)")
    psu.add_argument("email")
    psu.add_argument("--reason", default="manual suppression")
    psu.set_defaults(func=cmd_suppress)

    pr = sub.add_parser("reset", help="re-queue FAILED leads for another attempt")
    pr.add_argument("ids", nargs="+", type=int)
    pr.set_defaults(func=cmd_reset)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
