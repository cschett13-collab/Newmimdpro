"""Zenvy AI — Telegram bot backed by a local Ollama server.

Modes (system-prompt addendums on top of the base persona)
  /code    Builder    — production code, file paths
  /money   Cash Flow  — turn input into money-producing assets (8-step)
  /market  Marketing  — general copy, hooks, captions
  /ad      Ad Engine  — AIDA structure + batches (FB / TikTok / landing)
  /hook    Viral      — short, punchy, scroll-stopping hooks
  /funnel  Funnel     — lead magnet → checkout (7-step)
  /avatar  Customer   — 8-bullet customer avatar
  /sell    Make-It-Sell — upgrade an idea into something easier to sell
  /auto    Automation — APIs, Zapier, Make, Stripe, Airtable

Auto-routing
  Plain (non-slash) messages are routed by keyword:
    ad/hook/caption     -> marketing
    sell/money/clients  -> money
    code/build/api      -> code
    automate/workflow   -> automation
    else                -> chat

Memory (typed schema, persisted in SQLite)
  /remember name=... | business=... | tone=... | style=... | goal=... | offer=...
  /forget <field> | all
  /prefs

Other
  /menu                quick-action keyboard
  /templates <type>    business-type playbooks (localService|creator|agency|ecommerce)
  /score pain=X urgency=X ability=X explain=X repeat=X   weighted offer score
  /reset               clear THIS chat's history

Persistence
  ZENVY_DB_PATH (default ./zenvy.db) — survives restarts.
"""
from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
import time
from contextlib import contextmanager
from typing import Iterator

import httpx
from dotenv import load_dotenv
from telegram import KeyboardButton, ReplyKeyboardMarkup, Update

load_dotenv()
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

# ---------- config ----------

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
DB_PATH = os.getenv("ZENVY_DB_PATH", "zenvy.db")

# Tier selection: "free" = local Ollama, "pro" = bring-your-own-key (OpenAI-compatible).
TIER = os.getenv("ZENVY_TIER", "free").lower()
if TIER == "pro":
    API_BASE = os.getenv("ZENVY_API_URL", "https://api.openai.com/v1").rstrip("/")
    API_KEY = os.environ.get("ZENVY_API_KEY", "")
    CHAT_MODEL = os.getenv("ZENVY_PRO_CHAT_MODEL") or os.getenv("CHAT_MODEL", "gpt-4o-mini")
    CODER_MODEL = os.getenv("ZENVY_PRO_CODER_MODEL") or os.getenv("CODER_MODEL", "gpt-4o-mini")
    REASONING_MODEL = os.getenv("ZENVY_PRO_REASONING_MODEL") or os.getenv("REASONING_MODEL", "gpt-4o-mini")
    FAST_MODEL = os.getenv("ZENVY_PRO_FAST_MODEL") or os.getenv("FAST_MODEL", "gpt-4o-mini")
    if not API_KEY:
        raise SystemExit("ZENVY_TIER=pro requires ZENVY_API_KEY in .env")
else:
    OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
    API_BASE = OLLAMA_HOST + "/v1"
    API_KEY = "ollama"  # Ollama ignores auth but the OpenAI client wants something
    CHAT_MODEL = os.getenv("CHAT_MODEL", "llama3.1:8b")
    CODER_MODEL = os.getenv("CODER_MODEL", "qwen2.5-coder:7b")
    REASONING_MODEL = os.getenv("REASONING_MODEL", "deepseek-r1:8b")
    FAST_MODEL = os.getenv("FAST_MODEL", "mistral:7b")
AUTHORIZED_USER_IDS = {
    int(x) for x in os.getenv("AUTHORIZED_USER_IDS", "").split(",") if x.strip().isdigit()
}
HISTORY_PAIRS = 12
TELEGRAM_MAX = 4000

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("zenvy")


# ---------- persona + modes ----------

ZENVY_PERSONA = """You are Zenvy AI — a premium execution assistant. You help users move faster, think clearer, and turn ideas into real-world results.

Before each response, silently ask:
1. What is the user really trying to accomplish?
2. What would save them the most time?
3. What is the highest-leverage answer?
4. What could go wrong if they follow weak advice?

Before sending, silently check:
- Is this immediately useful?
- Is it specific?
- Can the user copy or act on it?
- Did I remove fluff?
- Did I include the next best move?

Rules:
- Be direct, useful, and outcome-focused — never robotic, no filler.
- Give the best next move, not just information.
- When the user is vague, make a smart assumption and continue.
- Prioritize money, speed, leverage, automation, and clarity when relevant.
- Give finished outputs the user can copy, send, post, or build with.
- Use short paragraphs and logical grouping; no walls of text.
- Turn ideas into offers, tasks into systems, skills into scalable assets.

Memory:
- Use stored user context only when relevant. Do not mention memory unless useful.
- Reference user goals/business/tone naturally; never repeat generic explanations.

Default response shape (use for serious answers):
Best move:
[direct answer]

Why:
[short reason]

Do this:
[steps]

Copy/paste:
[finished script, code, or message]

Premium layer:
- Don't just answer — convert the request into a usable asset, system, or next action.
- Whenever possible, produce a sellable offer, a faster workflow, a clearer message, a better ad, a stronger CTA, or a repeatable system.
- Think like a growth marketer, a software builder, a sales strategist, and a ruthless operator.

Always end with ONE next move (never overwhelm — pick the most obvious):
- "Want me to turn this into a landing page?"
- "Want 10 ad hooks for this?"
- "Want a pricing page?"
- "Want the full funnel?"
- "Want a cold DM script?"

Goal:
Maximize the user's speed, clarity, and revenue in every response."""

MODES: dict[str, str] = {
    "chat": "",
    "code": (
        "You are in Builder Mode. Give clean, production-minded code first, "
        "brief explanation second. Include file paths. Explain only what matters."
    ),
    "money": (
        "You are in Cash Flow Mode. Turn user input into money-producing assets.\n"
        "Always look for: what can be sold, who would buy it, why they'd buy now, "
        "how to reach them, how to make the offer clearer, how to reduce friction.\n\n"
        "Output exactly this structure:\n"
        "1. Offer\n"
        "2. Target buyer\n"
        "3. Pain point\n"
        "4. Promise\n"
        "5. Price suggestion\n"
        "6. Ad hook\n"
        "7. CTA\n"
        "8. Next action today"
    ),
    "marketing": (
        "You are in Marketing Mode. Write hooks, landing pages, ads, captions, "
        "and sales copy that convert. Outputs should be copy-paste-ready."
    ),
    "ad": (
        "You are in Ad Engine Mode. Use AIDA structure:\n"
        "Hook: grab attention in 1 sentence.\n"
        "Problem: call out the pain clearly.\n"
        "Agitation: make the user feel the cost of ignoring it.\n"
        "Solution: present the offer.\n"
        "Proof: credibility, result, or reason to believe.\n"
        "CTA: tell them exactly what to do next.\n\n"
        "Then generate:\n"
        "- 5 short-form video hooks\n"
        "- 3 Facebook ad versions\n"
        "- 3 TikTok captions\n"
        "- 3 landing page headlines"
    ),
    "hook": (
        "You are in Viral Hook Mode. Generate short, punchy, scroll-stopping hooks.\n"
        "Use these angles: Pain, Curiosity, Money, Speed, Mistake, Controversy, "
        "Before/After, Lazy Shortcut, Secret System, \"Nobody tells you this\".\n"
        "Avoid sounding corporate. No filler.\n\n"
        "Style anchors (this energy):\n"
        "- \"You're not broke because of your job. You're broke because you don't have an offer.\"\n"
        "- \"I used AI to turn one skill into a cash-flow system.\"\n"
        "- \"Most small businesses lose money because their offer is trash.\"\n\n"
        "Output 10 hooks numbered 1–10, tagged with the angle in brackets."
    ),
    "funnel": (
        "You are in Funnel Builder Mode. For any business idea, return:\n"
        "1. Lead magnet\n"
        "2. Landing page headline\n"
        "3. Main offer\n"
        "4. Upsell\n"
        "5. Follow-up sequence\n"
        "6. Retargeting ad\n"
        "7. Simple checkout flow"
    ),
    "avatar": (
        "You are in Customer Avatar Mode. Define:\n"
        "- Who they are\n"
        "- What they want\n"
        "- What they hate\n"
        "- What they fear\n"
        "- What they already tried\n"
        "- What they would gladly pay for\n"
        "- Where they hang out online\n"
        "- Best message to reach them"
    ),
    "sell": (
        "You are in Make-It-Sell Mode. Take the user's idea and improve it so it "
        "becomes easier to sell. Improve: offer clarity, buyer pain, promise, "
        "pricing, urgency, ad hook, CTA. Return the upgraded version only."
    ),
    "automation": (
        "You are in Automation Mode. Turn repeated tasks into workflows using APIs, "
        "Zapier, Make, Stripe, Airtable, or custom code. Give the concrete pipeline."
    ),
    "think": (
        "You are in Reasoning Mode. Take your time. Show your reasoning step by step "
        "before the final answer. Verify your logic before concluding."
    ),
    "fast": (
        "You are in Fast Mode. Answer in ≤3 sentences. No preamble, no caveats, "
        "no structure — just the direct answer."
    ),
}

CHAT_SYSTEM_PROMPT = os.getenv("CHAT_SYSTEM_PROMPT", ZENVY_PERSONA)


def system_for(mode: str) -> str:
    base = CHAT_SYSTEM_PROMPT
    addendum = MODES.get(mode, "")
    return f"{base}\n\n{addendum}".rstrip()


# ---------- intent detection / mode router ----------

ROUTING_RULES: list[tuple[str, set[str]]] = [
    ("marketing",  {"ad", "ads", "hook", "hooks", "caption", "captions"}),
    ("money",      {"sell", "money", "clients"}),
    ("code",       {"code", "build", "api"}),
    ("automation", {"automate", "workflow"}),
]
_ROUTING_RE: dict[str, re.Pattern] = {
    mode: re.compile(r"\b(?:" + "|".join(re.escape(w) for w in words) + r")\b", re.IGNORECASE)
    for mode, words in ROUTING_RULES
}


def choose_mode(text: str) -> str:
    for mode, _ in ROUTING_RULES:
        if _ROUTING_RE[mode].search(text):
            return mode
    return "chat"


# ---------- offer scorer ----------

def score_offer(pain: float, urgency: float, ability: float, explain: float, repeat: float) -> float:
    total = pain * 0.3 + urgency * 0.25 + ability * 0.2 + explain * 0.15 + repeat * 0.1
    return round(total * 10) / 10


# ---------- typed memory schema ----------

ENUM_TONES = {"direct", "friendly", "premium", "aggressive", "simple"}
ENUM_STYLES = {"short", "detailed", "step-by-step"}

SCHEMA: dict[str, dict] = {
    "name":     {"kind": "scalar"},
    "business": {"kind": "scalar"},
    "tone":     {"kind": "enum", "values": ENUM_TONES},
    "style":    {"kind": "enum", "values": ENUM_STYLES, "stored_as": "preferred_output_style"},
    "goal":     {"kind": "list", "stored_as": "goals"},
    "offer":    {"kind": "list", "stored_as": "saved_offers"},
}
LIST_FIELDS = {"goals", "saved_offers"}


def canonical_key(user_key: str) -> tuple[str, dict] | None:
    k = user_key.strip().lower().replace(" ", "_")
    if k in SCHEMA:
        spec = SCHEMA[k]
        return spec.get("stored_as", k), spec
    for ukey, spec in SCHEMA.items():
        if spec.get("stored_as") == k:
            return k, spec
    return None


# ---------- storage ----------

@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id   INTEGER NOT NULL,
                mode      TEXT    NOT NULL,
                role      TEXT    NOT NULL,
                content   TEXT    NOT NULL,
                ts        INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_messages_chat_mode ON messages(chat_id, mode, id);

            CREATE TABLE IF NOT EXISTS preferences (
                user_id INTEGER NOT NULL,
                key     TEXT    NOT NULL,
                value   TEXT    NOT NULL,
                ts      INTEGER NOT NULL,
                PRIMARY KEY (user_id, key)
            );

            CREATE TABLE IF NOT EXISTS tool_calls (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id   INTEGER NOT NULL,
                tool      TEXT    NOT NULL,
                args      TEXT,
                result    TEXT,
                ts        INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tool_chat ON tool_calls(chat_id, ts);
            """
        )


def log_tool_call(chat_id: int, tool: str, args: dict, result: str) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO tool_calls (chat_id, tool, args, result, ts) VALUES (?, ?, ?, ?, ?)",
            (chat_id, tool, json.dumps(args)[:500], result[:500], int(time.time())),
        )


def recent_tool_calls(chat_id: int, limit: int = 10) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT tool, args, result, ts FROM tool_calls WHERE chat_id=? ORDER BY id DESC LIMIT ?",
            (chat_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def append_message(chat_id: int, mode: str, role: str, content: str) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO messages (chat_id, mode, role, content, ts) VALUES (?, ?, ?, ?, ?)",
            (chat_id, mode, role, content, int(time.time())),
        )


def load_history(chat_id: int, mode: str, pairs: int = HISTORY_PAIRS) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE chat_id=? AND mode=? "
            "ORDER BY id DESC LIMIT ?",
            (chat_id, mode, pairs * 2),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def clear_history(chat_id: int) -> None:
    with db() as conn:
        conn.execute("DELETE FROM messages WHERE chat_id=?", (chat_id,))


def _get_raw_pref(conn: sqlite3.Connection, user_id: int, key: str) -> str | None:
    row = conn.execute(
        "SELECT value FROM preferences WHERE user_id=? AND key=?",
        (user_id, key),
    ).fetchone()
    return row["value"] if row else None


def get_memory(user_id: int) -> dict[str, str | list[str]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT key, value FROM preferences WHERE user_id=?", (user_id,)
        ).fetchall()
    out: dict[str, str | list[str]] = {}
    for r in rows:
        if r["key"] in LIST_FIELDS:
            try:
                out[r["key"]] = json.loads(r["value"])
            except json.JSONDecodeError:
                out[r["key"]] = []
        else:
            out[r["key"]] = r["value"]
    return out


def set_scalar(user_id: int, stored_key: str, value: str) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO preferences (user_id, key, value, ts) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, ts=excluded.ts",
            (user_id, stored_key, value, int(time.time())),
        )


def append_list(user_id: int, stored_key: str, value: str) -> list[str]:
    with db() as conn:
        existing = _get_raw_pref(conn, user_id, stored_key)
        items: list[str] = []
        if existing:
            try:
                items = json.loads(existing)
            except json.JSONDecodeError:
                items = []
        if value not in items:
            items.append(value)
        conn.execute(
            "INSERT INTO preferences (user_id, key, value, ts) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, ts=excluded.ts",
            (user_id, stored_key, json.dumps(items), int(time.time())),
        )
    return items


def delete_pref(user_id: int, stored_key: str) -> int:
    with db() as conn:
        cur = conn.execute(
            "DELETE FROM preferences WHERE user_id=? AND key=?", (user_id, stored_key)
        )
        return cur.rowcount


def clear_prefs(user_id: int) -> int:
    with db() as conn:
        cur = conn.execute("DELETE FROM preferences WHERE user_id=?", (user_id,))
        return cur.rowcount


# ---------- prompt assembly ----------

def build_user_context(memory: dict) -> str:
    if not memory:
        return ""
    name = memory.get("name") or "Unknown"
    business = memory.get("business") or "Unknown"
    goals = memory.get("goals") or []
    offers = memory.get("saved_offers") or []
    tone = memory.get("tone") or "direct"
    style = memory.get("preferred_output_style") or "short"
    parts = [
        "Known user context:",
        f"- Name: {name}",
        f"- Business: {business}",
        f"- Goals: {', '.join(goals) if goals else 'Unknown'}",
        f"- Saved offers: {', '.join(offers) if offers else 'None'}",
        f"- Preferred tone: {tone}",
        f"- Output style: {style}",
        "",
        "Use this context only when relevant. Do not mention memory unless useful.",
    ]
    return "\n".join(parts)


# ---------- helpers ----------

def authorized(user_id: int) -> bool:
    return not AUTHORIZED_USER_IDS or user_id in AUTHORIZED_USER_IDS


import tools as zenvy_tools  # noqa: E402

TOOL_LOOP_MAX = 4


async def call_model(model: str, messages: list[dict]) -> str:
    """Single-shot completion (no tools)."""
    headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(
            f"{API_BASE}/chat/completions",
            headers=headers,
            json={"model": model, "messages": messages, "stream": False},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def call_with_tools(model: str, messages: list[dict], chat_id: int) -> str:
    """Tool-enabled completion. Loops up to TOOL_LOOP_MAX rounds.

    Logs every tool call to the tool_calls table so users can see what the bot did.
    """
    headers = {"Authorization": f"Bearer {API_KEY}"} if API_KEY else {}
    msgs: list[dict] = list(messages)

    for _round in range(TOOL_LOOP_MAX):
        async with httpx.AsyncClient(timeout=600.0) as client:
            r = await client.post(
                f"{API_BASE}/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": msgs,
                    "tools": zenvy_tools.TOOL_SCHEMAS,
                    "stream": False,
                },
            )
            r.raise_for_status()
            data = r.json()

        msg = data["choices"][0]["message"]
        tool_calls = msg.get("tool_calls") or []

        if not tool_calls:
            return msg.get("content") or ""

        # Append the assistant's tool-call turn verbatim
        msgs.append(msg)

        for tc in tool_calls:
            fn_name = tc.get("function", {}).get("name", "")
            raw_args = tc.get("function", {}).get("arguments", {})
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except json.JSONDecodeError:
                args = {}
            log.info("tool_call: %s(%s)", fn_name, args)
            result = await zenvy_tools.execute_tool(fn_name, args or {})
            log_tool_call(chat_id, fn_name, args, result)
            msgs.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "name": fn_name,
                    "content": result,
                }
            )

    return "(tool-call loop hit limit; reply unfinished)"


async def send_long(update: Update, text: str) -> None:
    for i in range(0, len(text), TELEGRAM_MAX):
        await update.message.reply_text(text[i : i + TELEGRAM_MAX])


async def respond(update: Update, mode: str, prompt: str, model: str) -> None:
    chat_id = update.effective_chat.id
    user_id = update.effective_user.id

    base_system = system_for(mode)
    ctx = build_user_context(get_memory(user_id))
    system = f"{base_system}\n\n{ctx}".rstrip() if ctx else base_system

    history = load_history(chat_id, mode)
    messages = [{"role": "system", "content": system}, *history, {"role": "user", "content": prompt}]

    await update.effective_chat.send_action(ChatAction.TYPING)
    try:
        reply = await call_with_tools(model, messages, chat_id)
    except httpx.HTTPError as e:
        log.exception("model call failed")
        await update.message.reply_text(f"Model error: {e}")
        return

    append_message(chat_id, mode, "user", prompt)
    append_message(chat_id, mode, "assistant", reply)
    await send_long(update, reply)


# ---------- handlers ----------

QUICK_ACTIONS = [
    ["Make me money with this idea", "Turn this into an offer"],
    ["Write a landing page", "Create a viral ad"],
    ["Build an automation", "Improve this code"],
    ["Make this sound premium"],
]

BUSINESS_TEMPLATES: dict[str, list[str]] = {
    "localservice": [
        "Offer Builder",
        "Google Business Profile Optimizer",
        "Review Request Script",
        "Facebook Ad Generator",
        "Follow-Up Text Sequence",
    ],
    "creator": [
        "Viral Hook Generator",
        "Content Calendar",
        "Digital Product Builder",
        "DM Sales Script",
        "Landing Page Copy",
    ],
    "agency": [
        "Niche Finder",
        "Client Outreach System",
        "Proposal Generator",
        "Audit Report Builder",
        "Retainer Offer Builder",
    ],
    "ecommerce": [
        "Product Angle Finder",
        "Ad Hook Generator",
        "Landing Page Builder",
        "Email Sequence",
        "Upsell Builder",
    ],
}


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Zenvy AI online.\n"
        f"  chat:  {CHAT_MODEL}\n"
        f"  code:  {CODER_MODEL}\n\n"
        "Modes:\n"
        "  /code <prompt>      builder (production code)\n"
        "  /money <prompt>     cash flow (8-step)\n"
        "  /market <prompt>    marketing copy\n"
        "  /ad <prompt>        ad engine (AIDA + batches)\n"
        "  /hook <topic>       10 viral hooks\n"
        "  /funnel <idea>      lead magnet → checkout (7-step)\n"
        "  /avatar <niche>     customer avatar\n"
        "  /sell <idea>        upgrade an idea to make it easier to sell\n"
        "  /auto <prompt>      automation\n"
        "  /think <prompt>     reasoning model, step-by-step\n"
        "  /fast <prompt>      lightweight model, ≤3 sentences\n\n"
        "Tools:\n"
        "  /score pain=X urgency=X ability=X explain=X repeat=X\n"
        "  /templates <type>   localservice|creator|agency|ecommerce\n"
        "  /menu               quick-action keyboard\n"
        "  /log                show recent web/tool actions\n\n"
        "Web access:\n"
        "  Bot can browse — ask things like 'search the web for X'\n"
        "  or 'read this URL: https://...'\n\n"
        "Memory:\n"
        "  /remember name=...  /remember business=...\n"
        "  /remember tone=direct|friendly|premium|aggressive|simple\n"
        "  /remember style=short|detailed|step-by-step\n"
        "  /remember goal=...  /remember offer=...   (append)\n"
        "  /forget <field>|all     /prefs     /reset"
    )


async def cmd_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    keyboard = [[KeyboardButton(b) for b in row] for row in QUICK_ACTIONS]
    markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True, resize_keyboard=True)
    await update.message.reply_text("Pick a quick action:", reply_markup=markup)


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    clear_history(update.effective_chat.id)
    await update.message.reply_text("History cleared.")


async def _mode_cmd(update, context, mode: str, model: str) -> None:
    if not authorized(update.effective_user.id):
        return
    prompt = " ".join(context.args).strip()
    if not prompt:
        await update.message.reply_text(f"Usage: /{mode} <prompt>")
        return
    await respond(update, mode, prompt, model)


async def cmd_code(update, context):    await _mode_cmd(update, context, "code",       CODER_MODEL)
async def cmd_money(update, context):   await _mode_cmd(update, context, "money",      CHAT_MODEL)
async def cmd_market(update, context):  await _mode_cmd(update, context, "marketing",  CHAT_MODEL)
async def cmd_ad(update, context):      await _mode_cmd(update, context, "ad",         CHAT_MODEL)
async def cmd_hook(update, context):    await _mode_cmd(update, context, "hook",       CHAT_MODEL)
async def cmd_funnel(update, context):  await _mode_cmd(update, context, "funnel",     CHAT_MODEL)
async def cmd_avatar(update, context):  await _mode_cmd(update, context, "avatar",     CHAT_MODEL)
async def cmd_sell(update, context):    await _mode_cmd(update, context, "sell",       CHAT_MODEL)
async def cmd_auto(update, context):    await _mode_cmd(update, context, "automation", CHAT_MODEL)
async def cmd_think(update, context):   await _mode_cmd(update, context, "think",      REASONING_MODEL)
async def cmd_fast(update, context):    await _mode_cmd(update, context, "fast",       FAST_MODEL)


async def cmd_templates(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    arg = " ".join(context.args).strip().lower().replace(" ", "").replace("-", "")
    if not arg:
        types = ", ".join(BUSINESS_TEMPLATES.keys())
        await update.message.reply_text(f"Usage: /templates <type>\nTypes: {types}")
        return
    items = BUSINESS_TEMPLATES.get(arg)
    if not items:
        types = ", ".join(BUSINESS_TEMPLATES.keys())
        await update.message.reply_text(f"Unknown type. Try: {types}")
        return
    body = "\n".join(f"  • {x}" for x in items)
    await update.message.reply_text(f"{arg} playbook:\n{body}")


async def cmd_score(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    args = " ".join(context.args)
    parsed: dict[str, float] = {}
    for token in args.split():
        if "=" not in token:
            continue
        k, v = token.split("=", 1)
        try:
            parsed[k.strip().lower()] = float(v)
        except ValueError:
            pass
    required = ["pain", "urgency", "ability", "explain", "repeat"]
    missing = [k for k in required if k not in parsed]
    if missing:
        await update.message.reply_text(
            "Usage: /score pain=X urgency=X ability=X explain=X repeat=X (each 1–10)\n"
            f"Missing: {', '.join(missing)}"
        )
        return
    s = score_offer(parsed["pain"], parsed["urgency"], parsed["ability"],
                    parsed["explain"], parsed["repeat"])
    verdict = (
        "Strong — push it." if s >= 8 else
        "Solid — sharpen the weak axis." if s >= 6 else
        "Weak — rework the offer."
    )
    await update.message.reply_text(
        f"Offer score: {s}/10\n"
        f"  pain×0.30   = {parsed['pain'] * 0.3:.2f}\n"
        f"  urgency×0.25= {parsed['urgency'] * 0.25:.2f}\n"
        f"  ability×0.20= {parsed['ability'] * 0.2:.2f}\n"
        f"  explain×0.15= {parsed['explain'] * 0.15:.2f}\n"
        f"  repeat×0.10 = {parsed['repeat'] * 0.1:.2f}\n"
        f"\n{verdict}"
    )


async def cmd_remember(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    raw = " ".join(context.args).strip()
    if "=" not in raw:
        await update.message.reply_text(
            "Usage: /remember key=value\n"
            "Keys: name, business, tone, style, goal, offer"
        )
        return
    user_key, value = raw.split("=", 1)
    value = value.strip()
    if not value:
        await update.message.reply_text("Value is required.")
        return

    canon = canonical_key(user_key)
    if canon is None:
        stored_key = user_key.strip().lower().replace(" ", "_")
        set_scalar(update.effective_user.id, stored_key, value)
        await update.message.reply_text(f"Stored: {stored_key} = {value}")
        return

    stored_key, spec = canon
    if spec["kind"] == "enum":
        if value not in spec["values"]:
            allowed = ", ".join(sorted(spec["values"]))
            await update.message.reply_text(f"Invalid value. Allowed: {allowed}")
            return
        set_scalar(update.effective_user.id, stored_key, value)
        await update.message.reply_text(f"Stored: {stored_key} = {value}")
    elif spec["kind"] == "list":
        items = append_list(update.effective_user.id, stored_key, value)
        await update.message.reply_text(f"Added to {stored_key}. Now: {', '.join(items)}")
    else:
        set_scalar(update.effective_user.id, stored_key, value)
        await update.message.reply_text(f"Stored: {stored_key} = {value}")


async def cmd_forget(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    arg = " ".join(context.args).strip().lower()
    user_id = update.effective_user.id
    if not arg:
        await update.message.reply_text("Usage: /forget <field>  or  /forget all")
        return
    if arg == "all":
        n = clear_prefs(user_id)
        await update.message.reply_text(f"Cleared {n} preference(s).")
        return
    canon = canonical_key(arg)
    stored = canon[0] if canon else arg.replace(" ", "_")
    n = delete_pref(user_id, stored)
    await update.message.reply_text("Forgotten." if n else "No such preference.")


async def cmd_log(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show what the bot's been doing — recent web/tool calls in this chat."""
    if not authorized(update.effective_user.id):
        return
    rows = recent_tool_calls(update.effective_chat.id, limit=10)
    if not rows:
        await update.message.reply_text("No web/tool actions yet in this chat.")
        return
    import datetime as dt
    lines: list[str] = ["Recent actions (newest first):"]
    for r in rows:
        when = dt.datetime.fromtimestamp(r["ts"]).strftime("%m-%d %H:%M")
        args_short = (r["args"] or "")[:80]
        result_short = (r["result"] or "")[:80].replace("\n", " ")
        lines.append(f"\n[{when}] {r['tool']}({args_short})\n  -> {result_short}")
    await update.message.reply_text("\n".join(lines)[:TELEGRAM_MAX])


async def cmd_prefs(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    mem = get_memory(update.effective_user.id)
    if not mem:
        await update.message.reply_text("No preferences stored. Try /remember tone=direct")
        return
    lines: list[str] = []
    for k, v in mem.items():
        if isinstance(v, list):
            lines.append(f"  {k}: {', '.join(v) if v else '(empty)'}")
        else:
            lines.append(f"  {k} = {v}")
    await update.message.reply_text("Your memory:\n" + "\n".join(lines))


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    text = (update.message.text or "").strip()
    if not text:
        return
    mode = choose_mode(text)
    model = CODER_MODEL if mode == "code" else CHAT_MODEL
    await respond(update, mode, text, model)


def main() -> None:
    init_db()
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    for cmd, fn in [
        ("start", cmd_start), ("menu", cmd_menu), ("reset", cmd_reset),
        ("code", cmd_code), ("money", cmd_money), ("market", cmd_market),
        ("ad", cmd_ad), ("hook", cmd_hook), ("funnel", cmd_funnel),
        ("avatar", cmd_avatar), ("sell", cmd_sell), ("auto", cmd_auto),
        ("think", cmd_think), ("fast", cmd_fast),
        ("templates", cmd_templates), ("score", cmd_score), ("log", cmd_log),
        ("remember", cmd_remember), ("forget", cmd_forget), ("prefs", cmd_prefs),
    ]:
        app.add_handler(CommandHandler(cmd, fn))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    log.info(
        "Zenvy AI starting — tier=%s chat=%s code=%s reason=%s fast=%s api=%s db=%s",
        TIER, CHAT_MODEL, CODER_MODEL, REASONING_MODEL, FAST_MODEL, API_BASE, DB_PATH,
    )
    log.info(
        "Active integrations: %s (tools: %s)",
        zenvy_tools.ACTIVE_INTEGRATIONS,
        [t["function"]["name"] for t in zenvy_tools.TOOL_SCHEMAS],
    )
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
