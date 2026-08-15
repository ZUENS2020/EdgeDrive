import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/auth-guard";

export const runtime = "edge";

export function proxy(request: NextRequest) {
  const mode = (process.env.AUTH_MODE || "better-auth").trim().toLowerCase();
  if (mode === "none") return NextResponse.next();

  const { pathname } = request.nextUrl;
  const authed = hasSessionCookie(request.headers.get("cookie"));

  if (pathname.startsWith("/admin") && !authed) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/login" && authed) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login"],
};
