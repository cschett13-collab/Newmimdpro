"""Zenvy AI — autonomous agent runtime.

Long-running process that:
  - Executes scheduled agents on cron schedules
  - Records SQLite heartbeats so dead agents are detected
  - Logs failures and keeps the loop alive (systemd handles process restarts)

To register a new agent: add an Agent(...) entry at the bottom of this file
and either restart the systemd service or send the process SIGHUP.

Defaults:
  lead-gen   every 5 min     -> stub
  content    hourly           -> stub
  outreach   daily at 09:00   -> stub
"""
from __future__ import annotations

import asyncio
import logging
import os
import sqlite3
import time
from collections.abc import Awaitable, Callable
from contextlib import contextmanager
from typing import Iterator

from croniter import croniter

DB_PATH = os.getenv("ZENVY_DB_PATH", "zenvy.db")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
CHAT_MODEL = os.getenv("CHAT_MODEL", "qwen2.5:7b")
HEARTBEAT_TTL_SEC = 120
MONITOR_INTERVAL_SEC = 30
ERROR_BACKOFF_SEC = 10

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("zenvy.agents")


# ---------- storage ----------

@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS heartbeats (
                agent_id TEXT PRIMARY KEY,
                last_ts  INTEGER NOT NULL,
                last_result TEXT
            );
            CREATE TABLE IF NOT EXISTS agent_runs (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id  TEXT NOT NULL,
                ts        INTEGER NOT NULL,
                ok        INTEGER NOT NULL,
                detail    TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_runs_agent_ts ON agent_runs(agent_id, ts);
            """
        )


def write_heartbeat(agent_id: str, result: str = "") -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO heartbeats (agent_id, last_ts, last_result) VALUES (?, ?, ?) "
            "ON CONFLICT(agent_id) DO UPDATE SET last_ts=excluded.last_ts, last_result=excluded.last_result",
            (agent_id, int(time.time()), result),
        )


def record_run(agent_id: str, ok: bool, detail: str) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO agent_runs (agent_id, ts, ok, detail) VALUES (?, ?, ?, ?)",
            (agent_id, int(time.time()), 1 if ok else 0, detail[:500]),
        )


def is_alive(agent_id: str) -> bool:
    with db() as conn:
        row = conn.execute(
            "SELECT last_ts FROM heartbeats WHERE agent_id=?", (agent_id,)
        ).fetchone()
    if not row:
        return False
    return (time.time() - row[0]) < HEARTBEAT_TTL_SEC


# ---------- agent abstraction ----------

AgentFn = Callable[[], Awaitable[str]]


class Agent:
    def __init__(self, agent_id: str, cron: str, action: AgentFn) -> None:
        self.id = agent_id
        self.cron = cron
        self.action = action

    async def run_once(self) -> None:
        log.info("agent %s firing", self.id)
        try:
            result = await self.action()
            write_heartbeat(self.id, result[:200] if result else "ok")
            record_run(self.id, True, result or "")
            log.info("agent %s ok: %s", self.id, (result or "")[:120])
        except Exception as e:
            log.exception("agent %s failed", self.id)
            record_run(self.id, False, str(e))


# ---------- scheduler ----------

async def scheduler_loop(agents: list[Agent]) -> None:
    iters = {a.id: croniter(a.cron, time.time()) for a in agents}
    by_id = {a.id: a for a in agents}
    next_due: dict[str, float] = {a.id: iters[a.id].get_next(float) for a in agents}

    while True:
        agent_id = min(next_due, key=lambda k: next_due[k])
        sleep_for = max(0.0, next_due[agent_id] - time.time())
        if sleep_for:
            await asyncio.sleep(sleep_for)
        await by_id[agent_id].run_once()
        next_due[agent_id] = iters[agent_id].get_next(float)


async def monitor_loop(agents: list[Agent]) -> None:
    grace_until: dict[str, float] = {a.id: time.time() + HEARTBEAT_TTL_SEC for a in agents}
    while True:
        await asyncio.sleep(MONITOR_INTERVAL_SEC)
        now = time.time()
        for a in agents:
            if now < grace_until[a.id]:
                continue
            if not is_alive(a.id):
                log.warning("agent %s heartbeat stale (>%ds)", a.id, HEARTBEAT_TTL_SEC)


# ---------- agent stubs (replace these with real work) ----------

async def lead_gen() -> str:
    """Find new leads and store them. Replace with real source (RSS, scraper, API)."""
    return "stub: no source configured"


async def content() -> str:
    """Generate scheduled content (post/email/etc.). Replace with real publisher."""
    return "stub: no publisher configured"


async def outreach() -> str:
    """Send daily outreach (DMs, emails). Replace with real channel + recipients."""
    return "stub: no channel configured"


AGENTS: list[Agent] = [
    Agent("lead-gen", "*/5 * * * *", lead_gen),
    Agent("content",  "0 * * * *",   content),
    Agent("outreach", "0 9 * * *",   outreach),
]


async def main() -> None:
    init_db()
    log.info("Zenvy AI agents starting — %d agent(s) scheduled", len(AGENTS))
    for a in AGENTS:
        log.info("  %s @ %s", a.id, a.cron)
    await asyncio.gather(
        scheduler_loop(AGENTS),
        monitor_loop(AGENTS),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
