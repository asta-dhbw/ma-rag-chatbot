import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-cookie";

const isDev = process.env.NODE_ENV !== "production";

const PUBLIC_EXACT_PATHS = new Set([
  "/favicon.ico",
  "/oauth",
  "/api/auth/authorize",
  "/api/auth/callback",
  "/api/auth/check",
  "/api/auth/keycloak/authorize",
  "/api/auth/keycloak/callback",
  "/api/auth/keycloak/check",
]);
const PUBLIC_PATH_PREFIXES = ["/_next/"];
const PUBLIC_API_AUTH_PATHS = new Set([
  "/api/auth/authorize",
  "/api/auth/callback",
  "/api/auth/check",
  "/api/auth/keycloak/authorize",
  "/api/auth/keycloak/callback",
  "/api/auth/keycloak/check",
]);
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPublicPath(pathname) {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return typeof btoa === "function"
    ? btoa(bin)
    : Buffer.from(bytes).toString("base64");
}

function buildCsp(nonce) {
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`;
  const connectSrc = isDev ? "'self' ws: wss:" : "'self'";

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function isSameOriginRequest(request) {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const ownOrigin = new URL(request.url).origin;
  const allowed = new Set([ownOrigin, ...getAllowedOrigins()]);

  if (originHeader) return allowed.has(originHeader);
  if (refererHeader) {
    try {
      return allowed.has(new URL(refererHeader).origin);
    } catch {
      return false;
    }
  }
  return false;
}

function applyCsp(response, nonce) {
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("x-nonce", nonce);
  return response;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const isApi = pathname.startsWith("/api/");
  const nonce = generateNonce();

  if (isApi && !SAFE_METHODS.has(method) && !PUBLIC_API_AUTH_PATHS.has(pathname)) {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { error: "Cross-origin request blocked" },
        { status: 403 }
      );
    }
  }

  if (!isPublicPath(pathname)) {
    const cookie = request.cookies.get(AUTH_COOKIE_NAME);
    if (!cookie) {
      if (isApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/oauth", request.url));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applyCsp(response, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
