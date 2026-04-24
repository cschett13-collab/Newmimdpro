#!/usr/bin/env node
/**
 * generate-ad.mjs — Auto-generate social ad creative for IMD or any client.
 *
 * Calls the Anthropic API (Claude) to produce ad-copy variants for Meta
 * (Facebook + Instagram), Google Search, and TikTok, geo-targeted to
 * Neenah, WI + a configurable radius.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *     node scripts/marketing/generate-ad.mjs \
 *       --offer "Lead Engine: 20 booked appointments in 60 days or free" \
 *       --vertical "roofing contractor" \
 *       --city "Appleton, WI" \
 *       --radius 100 \
 *       --variants 5
 *
 * Output: writes JSON to ./out/ads-<vertical>-<timestamp>.json
 *         and prints a human-readable summary.
 *
 * No npm dependency required — uses native fetch and Node's argv parser.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7";

const args = parseArgs(process.argv.slice(2));
const offer = args.offer ?? "AI-powered Lead Engine for local service businesses";
const vertical = args.vertical ?? "local service business";
const city = args.city ?? "Neenah, WI";
const radius = Number(args.radius ?? 100);
const variants = Number(args.variants ?? 5);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ERROR: set ANTHROPIC_API_KEY in your environment.");
  process.exit(1);
}

const systemPrompt = `You are a senior direct-response copywriter for a Wisconsin-based AI marketing agency named IMD / Fox Valley Client Engine, headquartered in Neenah, WI. You write ads that convert local service businesses into booked appointments. You are blunt, specific, and never use buzzword soup. You never invent facts or stats. You write copy that sounds like it came from a sharp human, not a content mill.`;

const userPrompt = `Generate ${variants} distinct ad-copy variants for this campaign.

OFFER: ${offer}
TARGET VERTICAL: ${vertical}
GEO: ${city} (and surrounding ${radius} miles)

For EACH variant, produce all of the following formats:

1. Meta (Facebook + Instagram) feed ad:
   - "primary_text": 90-125 words, hook → pain → outcome → CTA
   - "headline": <= 27 chars
   - "description": <= 27 chars

2. Google Search Responsive ad:
   - "headlines": array of 5 strings, each <= 30 chars
   - "descriptions": array of 2 strings, each <= 90 chars

3. TikTok / Reels short-video script:
   - "hook": first 3 seconds, <= 15 words
   - "script": 25-second on-camera script, conversational
   - "on_screen_text": 3-5 short overlay phrases

Each variant should attack a DIFFERENT angle (e.g. fear of competitor,
seasonal urgency, bad-review recovery, owner-time-back, ROI math). Lead
with the angle name in a "angle" field.

Return ONLY a single JSON object with this shape:
{
  "campaign": { "vertical": "...", "city": "...", "radius_miles": ${radius}, "offer": "..." },
  "variants": [
    {
      "angle": "...",
      "meta": { "primary_text": "...", "headline": "...", "description": "..." },
      "google": { "headlines": ["..."], "descriptions": ["..."] },
      "tiktok": { "hook": "...", "script": "...", "on_screen_text": ["..."] }
    }
  ]
}

No prose outside the JSON.`;

console.log(`Generating ${variants} ad variants for ${vertical} in ${city} (${radius}mi)...`);

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  }),
});

if (!res.ok) {
  const errText = await res.text();
  console.error(`Anthropic API error ${res.status}:`, errText);
  process.exit(1);
}

const payload = await res.json();
const text = payload.content?.[0]?.text ?? "";
const json = extractJson(text);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const slug = vertical.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const outDir = resolve(__dirname, "..", "..", "out");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `ads-${slug}-${stamp}.json`);
await writeFile(outPath, JSON.stringify(json, null, 2));

console.log(`\nWrote ${json.variants?.length ?? 0} variants to ${outPath}\n`);
for (const v of json.variants ?? []) {
  console.log(`--- ${v.angle} ---`);
  console.log(`META:   ${v.meta?.headline} | ${v.meta?.description}`);
  console.log(`GOOGLE: ${(v.google?.headlines ?? []).slice(0, 3).join(" | ")}`);
  console.log(`TIKTOK: ${v.tiktok?.hook}`);
  console.log();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON found in model output:\n" + text);
  }
  return JSON.parse(text.slice(start, end + 1));
}
