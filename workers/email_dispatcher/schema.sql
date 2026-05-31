-- Initial schema for lead_queue.db.
-- Volume-mounted at /data/lead_queue.db inside the dispatcher container.
-- Insert rows manually (or via a future ingestion service) with
-- status='PENDING', then flip to 'APPROVED' once reviewed.

CREATE TABLE IF NOT EXISTS leads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_email   TEXT    NOT NULL,
    contact_name    TEXT,
    company         TEXT,
    subject         TEXT    NOT NULL,
    body            TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','APPROVED','SENT','FAILED','SUPPRESSED')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    approved_at     TEXT,
    sent_at         TEXT,
    last_error      TEXT,
    attempts        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);

-- Suppression list: any email present here is skipped (CAN-SPAM opt-outs).
CREATE TABLE IF NOT EXISTS suppressions (
    email       TEXT PRIMARY KEY,
    reason      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
