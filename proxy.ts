import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ONLY_PATHS, MOCK_SESSION_COOKIE, PROTECTED_PATHS } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.cookies.get(MOCK_SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAuthOnly = AUTH_ONLY_PATHS.some((path) => pathname === path);
  if (isAuthOnly && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/catalog/:path*",
    "/customers/:path*",
    "/pipeline/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};
