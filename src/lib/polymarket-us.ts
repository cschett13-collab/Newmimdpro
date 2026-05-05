// Polymarket US signed-request helper. Server-side only.
//
// Auth scheme (Ed25519):
//   message = timestamp_ms + method + path
//   sig     = base64( ed25519_sign(secret, utf8(message)) )
//   headers:
//     X-PM-Access-Key:  KEY_ID
//     X-PM-Timestamp:   timestamp_ms
//     X-PM-Signature:   sig
//
// Secret key in .env.local is base64-encoded; we use the first 32 bytes
// as the Ed25519 seed (matches the Python reference: from_private_bytes
// on b64decode(secret)[:32]).

import { createPrivateKey, sign } from "node:crypto";

const BASE = "https://api.polymarket.us";

function getCreds() {
  const keyId = process.env.POLYMARKET_US_KEY_ID;
  const secret = process.env.POLYMARKET_US_SECRET_KEY;
  if (!keyId || !secret) return null;
  return { keyId, secret };
}

export function isConfigured(): boolean {
  return getCreds() != null;
}

function buildPrivateKey(secretB64: string) {
  const seed = Buffer.from(secretB64, "base64").subarray(0, 32);
  // PKCS#8 wrapper for Ed25519: 30 2e 02 01 00 30 05 06 03 2b 65 70 04 22 04 20 + seed
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed,
  ]);
  return createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
}

function authHeaders(method: string, path: string): Record<string, string> {
  const creds = getCreds();
  if (!creds) throw new Error("polymarket-us credentials not configured");
  const ts = String(Date.now());
  const msg = Buffer.from(`${ts}${method}${path}`, "utf8");
  const pk = buildPrivateKey(creds.secret);
  const signature = sign(null, msg, pk).toString("base64");
  return {
    "X-PM-Access-Key": creds.keyId,
    "X-PM-Timestamp": ts,
    "X-PM-Signature": signature,
    "Content-Type": "application/json",
  };
}

export type SignedRequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

export async function signedRequest<T>(
  path: string,
  opts: SignedRequestOptions = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  if (!path.startsWith("/")) path = `/${path}`;
  const method = opts.method ?? "GET";
  try {
    const headers = authHeaders(method, path);
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: text };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status: 502, error: "non-JSON response" };
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "request failed",
    };
  }
}

export async function getPositions() {
  return signedRequest<unknown>("/v1/portfolio/positions");
}

export async function getBalance() {
  return signedRequest<unknown>("/v1/portfolio/balance");
}

export async function getOpenOrders() {
  return signedRequest<unknown>("/v1/portfolio/orders");
}

export async function getMe() {
  return signedRequest<unknown>("/v1/me");
}
