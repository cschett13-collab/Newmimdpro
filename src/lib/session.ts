import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "fvce_portal_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

export type Session = {
  email: string;
  iat: number;
};

function secretKey() {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "PORTAL_SESSION_SECRET is missing. Set it in .env.local (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      email: String(payload.email),
      iat: Number(payload.iat ?? 0),
    };
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export function verifyCredentials(email: string, password: string) {
  const expectedEmail = process.env.PORTAL_ADMIN_EMAIL;
  const expectedPassword = process.env.PORTAL_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;
  return (
    email.trim().toLowerCase() === expectedEmail.trim().toLowerCase() &&
    password === expectedPassword
  );
}
