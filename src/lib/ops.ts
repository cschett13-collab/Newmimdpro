import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

export const DraftSchema = z.object({
  id: z.string().min(1),
  to: z.string().email(),
  from: z.string().email().optional(),
  subject: z.string().min(1),
  body: z.string().default(""),
  lead: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["ready", "sent", "skipped"]).default("ready"),
  createdAt: z.string().datetime().optional(),
});

export type Draft = z.infer<typeof DraftSchema>;

export const SentinelStatusSchema = z.object({
  lastScanAt: z.string().datetime().nullable(),
  status: z.enum(["ok", "stale", "error", "unknown"]).default("unknown"),
  message: z.string().optional(),
});

export type SentinelStatus = z.infer<typeof SentinelStatusSchema>;

const DRAFTS_DEFAULT = "data/drafts.json";
const SENTINEL_DEFAULT = "data/sentinel-status.json";

function resolvePath(envVar: string, fallback: string): string {
  const p = process.env[envVar];
  return resolve(process.cwd(), p && p.length > 0 ? p : fallback);
}

export async function getDrafts(): Promise<{
  drafts: Draft[];
  source: string;
  error: string | null;
}> {
  const source = resolvePath("PORTAL_DRAFTS_PATH", DRAFTS_DEFAULT);
  try {
    const raw = await readFile(source, "utf8");
    const parsed = z.array(DraftSchema).parse(JSON.parse(raw));
    return { drafts: parsed, source, error: null };
  } catch (err) {
    if (isMissingFile(err)) {
      return { drafts: [], source, error: null };
    }
    return {
      drafts: [],
      source,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function getSentinelStatus(): Promise<{
  status: SentinelStatus | null;
  source: string;
  error: string | null;
}> {
  const source = resolvePath("PORTAL_SENTINEL_STATUS_PATH", SENTINEL_DEFAULT);
  try {
    const raw = await readFile(source, "utf8");
    const parsed = SentinelStatusSchema.parse(JSON.parse(raw));
    return { status: parsed, source, error: null };
  } catch (err) {
    if (isMissingFile(err)) {
      return { status: null, source, error: null };
    }
    return {
      status: null,
      source,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function isMissingFile(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  );
}

export function sentinelSeverity(
  s: SentinelStatus | null,
): "ok" | "warn" | "error" | "unknown" {
  if (!s) return "unknown";
  if (s.status === "error") return "error";
  if (s.status === "ok") {
    if (!s.lastScanAt) return "warn";
    const age = Date.now() - new Date(s.lastScanAt).getTime();
    if (age > 48 * 60 * 60 * 1000) return "error";
    if (age > 24 * 60 * 60 * 1000) return "warn";
    return "ok";
  }
  if (s.status === "stale") return "warn";
  return "unknown";
}
