import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ONLY_PATHS, PROTECTED_PATHS } from "@/lib/auth/session";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);
  const isAuthenticated = Boolean(user);

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

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/catalog/:path*",
    "/customers/:path*",
    "/pipeline/:path*",
    "/settings/:path*",
    "/quotes/:path*",
    "/onboarding/:path*",
    "/login",
    "/signup",
  ],
};
