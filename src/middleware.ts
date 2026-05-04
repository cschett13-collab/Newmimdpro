import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "fvce_portal_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/polymarket"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return redirectLogin(req);

  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) return redirectLogin(req);
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return NextResponse.next();
  } catch {
    return redirectLogin(req);
  }
}

function redirectLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
