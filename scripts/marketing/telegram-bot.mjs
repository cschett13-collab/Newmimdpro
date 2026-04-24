#!/usr/bin/env node
/**
 * telegram-bot.mjs — IMD's inbound Telegram intake agent.
 *
 * Behavior:
 *   - Long-polls Telegram for incoming messages to your bot.
 *   - Routes each message through Claude (Anthropic API) with a system
 *     prompt locked to IMD's intake script: it qualifies leads in the
 *     Neenah, WI + 100mi service area.
 *   - When the lead is qualified (industry + city + monthly revenue
 *     captured), pushes the contact into HighLevel via the Inbound
 *     Webhook URL configured in the env.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN        — from @BotFather
 *   ANTHROPIC_API_KEY         — Anthropic API key
 *   HL_INBOUND_WEBHOOK_URL    — HighLevel inbound webhook for new contacts
 *                               (set up in HL: Automations -> Workflows ->
 *                                Inbound Webhook trigger)
 *   IMD_CALENDAR_LINK         — public booking link to hand off qualified leads
 *
 * Optional:
 *   ANTHROPIC_MODEL           — defaults to claude-opus-4-7
 *   IMD_SERVICE_RADIUS_MI     — defaults to 100
 *   IMD_HQ_CITY               — defaults to "Neenah, WI"
 *
 * Usage:
 *   node scripts/marketing/telegram-bot.mjs
 *
 * For production, run under a process supervisor (systemd / pm2) on a
 * small VPS, or convert to a Vercel serverless function with Telegram
 * webhooks instead of long-polling.
 */

const TG_TOKEN = need("TELEGRAM_BOT_TOKEN");
const ANTH_KEY = need("ANTHROPIC_API_KEY");
const HL_WEBHOOK = process.env.HL_INBOUND_WEBHOOK_URL ?? "";
const CALENDAR = process.env.IMD_CALENDAR_LINK ?? "https://calendly.com/imd";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";
const HQ = process.env.IMD_HQ_CITY ?? "Neenah, WI";
const RADIUS = Number(process.env.IMD_SERVICE_RADIUS_MI ?? 100);

const TG = `https://api.telegram.org/bot${TG_TOKEN}`;

const SYSTEM_PROMPT = `You are IMD's intake agent on Telegram. IMD (Fox Valley Client Engine) is an AI-marketing agency in ${HQ} that builds Lead Engines for local service businesses.

YOUR JOB:
  1. Greet the prospect warmly, in 1-2 sentences. Sound human, not corporate.
  2. Qualify them by collecting: business name, city, industry, current monthly revenue range, biggest marketing pain.
  3. Confirm they are within ${RADIUS} miles of ${HQ}. We serve roughly: Appleton, Oshkosh, Neenah, Menasha, Green Bay, Fond du Lac, Sheboygan, Wausau, Stevens Point, Madison-edge.
  4. If they're outside the service area, politely tell them we can refer them to a partner.
  5. Once qualified, send them this booking link: ${CALENDAR}
  6. Ask one question at a time. Never dump a form. Be concise.

OUTPUT RULES:
  - Always reply as plain text addressed to the prospect.
  - When you have collected ALL of: business_name, city, industry, monthly_revenue, pain — and the city is in-area — emit a final marker line at the very end of your reply on its own line, exactly:
      <<QUALIFIED>>{"business_name":"...","city":"...","industry":"...","monthly_revenue":"...","pain":"..."}
    The marker is a signal to the harness; the prospect will not see it (the harness strips it).
  - Never invent facts. If you do not know something, ask.`;

// In-memory conversation store. For production swap for Redis or a DB.
const sessions = new Map();

let offset = 0;
console.log(`IMD Telegram bot online. HQ=${HQ}, radius=${RADIUS}mi, model=${MODEL}`);

while (true) {
  try {
    const updates = await tg("getUpdates", { offset, timeout: 25 });
    for (const u of updates) {
      offset = u.update_id + 1;
      if (u.message?.text) {
        await handleMessage(u.message);
      }
    }
  } catch (e) {
    console.error("Poll error:", e.message);
    await sleep(2000);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  const session = sessions.get(chatId) ?? { history: [] };
  session.history.push({ role: "user", content: text });

  const reply = await askClaude(session.history);
  const { visible, qualified } = parseReply(reply);

  session.history.push({ role: "assistant", content: reply });
  sessions.set(chatId, session);

  await tg("sendMessage", { chat_id: chatId, text: visible });

  if (qualified) {
    console.log(`Qualified lead from chat ${chatId}:`, qualified);
    await pushToHighLevel({
      ...qualified,
      telegram_chat_id: String(chatId),
      telegram_username: msg.from?.username ?? null,
      transcript: session.history
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n"),
    });
  }
}

async function askClaude(history) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTH_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history.slice(-20),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

function parseReply(reply) {
  const marker = reply.lastIndexOf("<<QUALIFIED>>");
  if (marker === -1) return { visible: reply.trim(), qualified: null };
  const visible = reply.slice(0, marker).trim();
  const jsonStr = reply.slice(marker + "<<QUALIFIED>>".length).trim();
  try {
    return { visible, qualified: JSON.parse(jsonStr) };
  } catch {
    return { visible: reply.trim(), qualified: null };
  }
}

async function pushToHighLevel(payload) {
  if (!HL_WEBHOOK) {
    console.warn("HL_INBOUND_WEBHOOK_URL not set; skipping CRM push.");
    return;
  }
  try {
    const res = await fetch(HL_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("HL webhook failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("HL webhook error:", e.message);
  }
}

async function tg(method, params) {
  const res = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
  return data.result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}
