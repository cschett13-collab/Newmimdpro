"""Telegram bot that routes messages to a local Ollama server.

/code <prompt>  -> CODER_MODEL
anything else   -> CHAT_MODEL
/reset          -> clear conversation history for this chat
"""
from __future__ import annotations

import logging
import os
from collections import defaultdict

import httpx
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
CHAT_MODEL = os.getenv("CHAT_MODEL", "qwen2.5:7b")
CODER_MODEL = os.getenv("CODER_MODEL", "qwen2.5-coder:7b")
TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
CHAT_SYSTEM_PROMPT = os.getenv(
    "CHAT_SYSTEM_PROMPT",
    "You are a helpful assistant running locally on the user's own hardware. Be concise.",
)
CODE_SYSTEM_PROMPT = os.getenv(
    "CODE_SYSTEM_PROMPT",
    "You are a coding assistant. Reply with working code first, brief explanation second.",
)
AUTHORIZED_USER_IDS = {
    int(x) for x in os.getenv("AUTHORIZED_USER_IDS", "").split(",") if x.strip().isdigit()
}
HISTORY_PAIRS = 12
TELEGRAM_MAX = 4000

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("ai-bot")

# (chat_id, mode) -> messages
history: dict[tuple[int, str], list[dict]] = defaultdict(list)


def authorized(user_id: int) -> bool:
    return not AUTHORIZED_USER_IDS or user_id in AUTHORIZED_USER_IDS


async def call_ollama(model: str, messages: list[dict]) -> str:
    async with httpx.AsyncClient(timeout=600.0) as client:
        r = await client.post(
            f"{OLLAMA_HOST}/api/chat",
            json={"model": model, "messages": messages, "stream": False},
        )
        r.raise_for_status()
        return r.json()["message"]["content"]


async def send_long(update: Update, text: str) -> None:
    for i in range(0, len(text), TELEGRAM_MAX):
        await update.message.reply_text(text[i : i + TELEGRAM_MAX])


async def respond(update: Update, mode: str, prompt: str, system: str, model: str) -> None:
    chat_id = update.effective_chat.id
    key = (chat_id, mode)
    msgs = history[key]
    if not msgs:
        msgs.append({"role": "system", "content": system})
    msgs.append({"role": "user", "content": prompt})

    await update.effective_chat.send_action(ChatAction.TYPING)

    try:
        reply = await call_ollama(model, msgs)
    except httpx.HTTPError as e:
        log.exception("ollama call failed")
        await update.message.reply_text(f"Local model error: {e}")
        msgs.pop()
        return

    msgs.append({"role": "assistant", "content": reply})
    if len(msgs) > 1 + HISTORY_PAIRS * 2:
        msgs[:] = [msgs[0]] + msgs[-(HISTORY_PAIRS * 2) :]

    await send_long(update, reply)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Local AI bot online.\n"
        f"  chat:  {CHAT_MODEL}\n"
        f"  code:  {CODER_MODEL}\n\n"
        "Use /code <prompt> for coding. Anything else is chat. /reset to clear history."
    )


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    history.pop((chat_id, "chat"), None)
    history.pop((chat_id, "code"), None)
    await update.message.reply_text("History cleared.")


async def cmd_code(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    prompt = " ".join(context.args).strip()
    if not prompt:
        await update.message.reply_text("Usage: /code <prompt>")
        return
    await respond(update, "code", prompt, CODE_SYSTEM_PROMPT, CODER_MODEL)


async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not authorized(update.effective_user.id):
        return
    text = (update.message.text or "").strip()
    if not text:
        return
    await respond(update, "chat", text, CHAT_SYSTEM_PROMPT, CHAT_MODEL)


def main() -> None:
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("reset", cmd_reset))
    app.add_handler(CommandHandler("code", cmd_code))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))
    log.info("starting bot — chat=%s code=%s ollama=%s", CHAT_MODEL, CODER_MODEL, OLLAMA_HOST)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
