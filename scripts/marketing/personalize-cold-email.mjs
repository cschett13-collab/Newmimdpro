#!/usr/bin/env node
/**
 * personalize-cold-email.mjs — turn a CSV of local prospects into
 * personalized cold-email first-lines using Claude.
 *
 * Input CSV columns (header row required):
 *   business_name, city, state, website, industry, owner_first_name, notes
 *
 * Output: writes a new CSV alongside the input with two extra columns:
 *   first_line, subject
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *     node scripts/marketing/personalize-cold-email.mjs \
 *       --in prospects.csv \
 *       --out prospects-personalized.csv \
 *       --offer "AI Lead Engine: 20 booked appts/mo or you don't pay"
 *
 * Notes:
 *   - Skips rows missing business_name or city.
 *   - Uses Claude Haiku 4.5 by default for cost (override with ANTHROPIC_MODEL).
 *   - Throttles to 4 concurrent requests.
 *   - Idempotent on re-runs: rows that already have a first_line are kept.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const inPath = args.in ?? "prospects.csv";
const outPath = args.out ?? inPath.replace(/\.csv$/, "-personalized.csv");
const offer = args.offer ?? "AI Lead Engine: 20 booked appointments in 60 days or you don't pay";
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: set ANTHROPIC_API_KEY in your environment.");
  process.exit(1);
}

const raw = await readFile(resolve(inPath), "utf8");
const rows = parseCsv(raw);
const header = rows[0];
const data = rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));

console.log(`Loaded ${data.length} rows from ${inPath}`);

const queue = data.map((row, idx) => ({ row, idx }));
const results = new Array(data.length);
const CONCURRENCY = 4;

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

async function worker() {
  while (queue.length) {
    const job = queue.shift();
    if (!job) return;
    const { row, idx } = job;
    if (!row.business_name || !row.city) {
      results[idx] = { ...row, first_line: "", subject: "" };
      continue;
    }
    if (row.first_line && row.subject) {
      results[idx] = row;
      continue;
    }
    try {
      const { first_line, subject } = await personalize(row);
      results[idx] = { ...row, first_line, subject };
      process.stdout.write(".");
    } catch (e) {
      console.error(`\nrow ${idx} failed:`, e.message);
      results[idx] = { ...row, first_line: "", subject: "" };
    }
  }
}

const outHeader = Array.from(new Set([...header, "first_line", "subject"]));
const outCsv = [outHeader.join(",")]
  .concat(results.map((r) => outHeader.map((h) => csvEscape(r?.[h] ?? "")).join(",")))
  .join("\n");

await writeFile(resolve(outPath), outCsv);
console.log(`\nWrote ${outPath}`);

async function personalize(row) {
  const userPrompt = `Write ONE cold-email first line and ONE subject line for this prospect.

PROSPECT:
  business: ${row.business_name}
  city: ${row.city}, ${row.state || "WI"}
  industry: ${row.industry || "local service business"}
  website: ${row.website || "unknown"}
  owner first name: ${row.owner_first_name || "unknown"}
  extra notes: ${row.notes || "none"}

OFFER (do NOT pitch directly in the first line — earn the read first):
  ${offer}

RULES:
  - First line is ONE sentence, max 18 words, observational and specific to the prospect.
  - It must reference the city, the business, OR something concrete from notes.
  - No "Hope this finds you well." No "I came across your business." No flattery.
  - Subject is max 5 words, lowercase, no clickbait, no emojis.
  - Output ONLY a single JSON object: {"first_line":"...","subject":"..."}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1) throw new Error("no JSON in: " + text);
  return JSON.parse(text.slice(start, end + 1));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[a.slice(2)] = next;
        i++;
      } else {
        out[a.slice(2)] = true;
      }
    }
  }
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c === "\r") {
      // skip
    } else {
      cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.length && r.some((v) => v !== ""));
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
