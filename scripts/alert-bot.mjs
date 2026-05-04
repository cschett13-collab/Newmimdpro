#!/usr/bin/env node
// Telegram price-alert bot — runs on your PC, pings YOU when YOUR prepared
// price levels hit. Not tips. Not whale follows. Your own watchlist.
//
// Usage:
//   1. Create a Telegram bot via @BotFather, copy the token
//   2. Get your chat ID: message your bot, then visit
//      https://api.telegram.org/bot<TOKEN>/getUpdates
//   3. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local
//   4. Edit alerts.json with your watchlist
//   5. Run:  node scripts/alert-bot.mjs
//
// The bot polls every 60s. Each alert fires once until reset (price moves
// back through the level, or alerts.json is edited).

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ALERTS_PATH = join(ROOT, "alerts.json");
const STATE_PATH = join(ROOT, ".alert-state.json");
const POLL_MS = 60_000;

loadEnv(join(ROOT, ".env.local"));

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  console.error(
    "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env.local. See script header.",
  );
  process.exit(1);
}

if (!existsSync(ALERTS_PATH)) {
  console.error(
    `No alerts.json found. Copy alerts.example.json to alerts.json and edit.`,
  );
  process.exit(1);
}

let alerts = JSON.parse(readFileSync(ALERTS_PATH, "utf8"));
let state = existsSync(STATE_PATH)
  ? JSON.parse(readFileSync(STATE_PATH, "utf8"))
  : {};

console.log(`Loaded ${alerts.length} alerts. Polling every ${POLL_MS / 1000}s.`);
notify(`🟢 Alert bot started. Watching ${alerts.length} levels.`).catch(() => {});

run();
setInterval(run, POLL_MS);

async function run() {
  for (const alert of alerts) {
    try {
      const price = await fetchPrice(alert);
      if (price == null) continue;
      const key = alertKey(alert);
      const triggered = check(alert, price);
      if (triggered && !state[key]) {
        state[key] = { firedAt: Date.now(), price };
        await notify(formatMsg(alert, price));
        save();
      } else if (!triggered && state[key]) {
        delete state[key];
        save();
      }
    } catch (err) {
      console.error(`[${alertKey(alert)}]`, err.message);
    }
  }
}

function check(alert, price) {
  if (alert.above != null && price >= alert.above) return true;
  if (alert.below != null && price <= alert.below) return true;
  return false;
}

function formatMsg(alert, price) {
  const label = alert.label || alertKey(alert);
  const dir = alert.above != null && price >= alert.above ? "↑ above" : "↓ below";
  const threshold = alert.above ?? alert.below;
  return `🚨 ${label}\nPrice ${formatPrice(alert, price)} ${dir} ${formatPrice(alert, threshold)}\n\n👀 Open the chart. Don't trade yet — re-read your plan.`;
}

function formatPrice(alert, p) {
  if (alert.type === "polymarket") return `${(p * 100).toFixed(1)}¢`;
  return `$${p.toFixed(2)}`;
}

function alertKey(a) {
  if (a.type === "polymarket")
    return `pm:${a.slug}:${a.outcome}:${a.above ?? "_"}:${a.below ?? "_"}`;
  return `stk:${a.symbol}:${a.above ?? "_"}:${a.below ?? "_"}`;
}

async function fetchPrice(alert) {
  if (alert.type === "polymarket") return fetchPolymarketPrice(alert);
  if (alert.type === "stock") return fetchStockPrice(alert);
  console.warn(`Unknown alert type: ${alert.type}`);
  return null;
}

async function fetchPolymarketPrice({ slug, outcome }) {
  const res = await fetch(
    `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`,
  );
  if (!res.ok) throw new Error(`gamma ${res.status}`);
  const arr = await res.json();
  const m = Array.isArray(arr) ? arr[0] : null;
  if (!m) return null;
  const outcomes = parseJSONField(m.outcomes);
  const prices = parseJSONField(m.outcomePrices);
  if (!outcomes || !prices) return null;
  const idx = outcomes.findIndex(
    (o) => String(o).toLowerCase() === String(outcome).toLowerCase(),
  );
  if (idx < 0) return null;
  return Number(prices[idx]);
}

async function fetchStockPrice({ symbol }) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`,
    { headers: { "user-agent": "Mozilla/5.0" } },
  );
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  return meta?.regularMarketPrice ?? null;
}

function parseJSONField(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

async function notify(text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, disable_notification: false }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`telegram ${res.status}: ${body}`);
  }
}

function save() {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
