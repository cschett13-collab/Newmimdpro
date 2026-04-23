#!/usr/bin/env node
/**
 * Export Pitcher drafts as .eml files.
 *
 * Reads drafts from data/drafts.json (or $PORTAL_DRAFTS_PATH) and writes one
 * RFC 5322 message per draft into exports/drafts/ (or $PORTAL_DRAFTS_EXPORT_DIR).
 * Drag the .eml files into Apple Mail / Outlook / Thunderbird to open them as
 * pre-filled compose windows.
 *
 * By default only drafts with status="ready" (or missing status) are exported.
 * Pass --all to include every entry.
 *
 * Usage:
 *   node scripts/export-drafts.mjs
 *   node scripts/export-drafts.mjs --all
 *   PORTAL_DRAFTS_PATH=/some/path.json node scripts/export-drafts.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const includeAll = args.has("--all");

const source = resolve(
  process.cwd(),
  process.env.PORTAL_DRAFTS_PATH || "data/drafts.json",
);
const outDir = resolve(
  process.cwd(),
  process.env.PORTAL_DRAFTS_EXPORT_DIR || "exports/drafts",
);

let raw;
try {
  raw = await readFile(source, "utf8");
} catch (err) {
  if (err.code === "ENOENT") {
    console.error(`No drafts file at ${source}.`);
    console.error(
      `Create it (see data/drafts.example.json) or set PORTAL_DRAFTS_PATH.`,
    );
    process.exit(1);
  }
  throw err;
}

let drafts;
try {
  drafts = JSON.parse(raw);
} catch (err) {
  console.error(`Couldn't parse ${source} as JSON: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(drafts)) {
  console.error(`Expected ${source} to be a JSON array.`);
  process.exit(1);
}

const selected = includeAll
  ? drafts
  : drafts.filter((d) => (d.status ?? "ready") === "ready");

if (selected.length === 0) {
  console.log(
    `No${includeAll ? "" : " ready"} drafts in ${source}.${
      includeAll ? "" : " Pass --all to export every entry."
    }`,
  );
  process.exit(0);
}

await mkdir(outDir, { recursive: true });

const results = [];
for (const draft of selected) {
  const problems = validate(draft);
  if (problems.length > 0) {
    results.push({ id: draft.id ?? "(no id)", ok: false, reason: problems.join("; ") });
    continue;
  }
  const filename = `${safeSlug(draft.id)}.eml`;
  const path = resolve(outDir, filename);
  await writeFile(path, buildEml(draft), "utf8");
  results.push({ id: draft.id, ok: true, path });
}

const ok = results.filter((r) => r.ok);
const bad = results.filter((r) => !r.ok);

for (const r of ok) console.log(`wrote ${r.path}`);
for (const r of bad) console.warn(`skipped ${r.id}: ${r.reason}`);

console.log(`\nExported ${ok.length}/${selected.length} drafts to ${outDir}`);
if (bad.length > 0) process.exit(2);

function validate(d) {
  const problems = [];
  if (!d || typeof d !== "object") return ["not an object"];
  if (!d.id || typeof d.id !== "string") problems.push("missing id");
  if (!d.to || typeof d.to !== "string") problems.push("missing to");
  if (!d.subject || typeof d.subject !== "string") problems.push("missing subject");
  return problems;
}

function safeSlug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "draft";
}

function buildEml(draft) {
  const date = new Date(draft.createdAt || Date.now()).toUTCString();
  const headers = [
    draft.from ? `From: ${draft.from}` : null,
    `To: ${draft.to}`,
    `Subject: ${encodeHeader(draft.subject)}`,
    `Date: ${date}`,
    `Message-ID: <${draft.id}@fvce-portal.local>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "X-Unsent: 1", // Outlook honors this to open as draft
  ].filter(Boolean);

  const body = normalizeNewlines(draft.body ?? "");
  return `${headers.join("\r\n")}\r\n\r\n${body}\r\n`;
}

function encodeHeader(value) {
  // ASCII-only? leave as-is. Otherwise encode as MIME encoded-word (RFC 2047).
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const b64 = Buffer.from(value, "utf8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function normalizeNewlines(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r\n");
}
