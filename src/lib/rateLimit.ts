type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ANON_LIMIT = 30;            // anonymous req/hour
const OWNER_LIMIT = Infinity;

export function checkRate(key: string, isOwner: boolean): { ok: boolean; remaining: number; resetIn: number } {
  if (isOwner) return { ok: true, remaining: Infinity, resetIn: 0 };
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: ANON_LIMIT - 1, resetIn: WINDOW_MS };
  }
  if (b.count >= ANON_LIMIT) {
    return { ok: false, remaining: 0, resetIn: WINDOW_MS - (now - b.windowStart) };
  }
  b.count += 1;
  return { ok: true, remaining: ANON_LIMIT - b.count, resetIn: WINDOW_MS - (now - b.windowStart) };
}

export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
