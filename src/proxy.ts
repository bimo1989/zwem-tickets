import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";

export function proxy(req: NextRequest) {
  const isAdminPath =
    req.nextUrl.pathname.startsWith("/admin") &&
    req.nextUrl.pathname !== "/admin/login";
  const isAdminApiPath =
    req.nextUrl.pathname.startsWith("/api/admin") &&
    req.nextUrl.pathname !== "/api/admin/login";

  if (!isAdminPath && !isAdminApiPath) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = process.env.ADMIN_SESSION_SECRET;

  if (!expected || sessionCookie !== expected) {
    if (isAdminApiPath) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
