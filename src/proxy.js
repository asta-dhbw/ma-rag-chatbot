import { NextResponse } from "next/server";

export function middleware(request) {
  const cookie = request.cookies.get("keycloak_authenticated");
  const { pathname } = request.nextUrl;

  const isPublic = pathname.startsWith("/api/auth") || 
                   pathname.startsWith("/oauth") ||
                   pathname.startsWith("/_next") ||
                   pathname === "/favicon.ico";

  if (!isPublic && !cookie) {
    return NextResponse.redirect(new URL("/oauth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
