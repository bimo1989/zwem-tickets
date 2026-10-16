import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";
const SCANNER_COOKIE = "scanner_session";

// What a volunteer code may reach at most. This is the union of what a
// 'scanner' and a 'helper' can do, because this file has no database access
// and cannot tell the two apart — the exact role is checked by getRole() in
// each page and route below. Everything outside this list is admin-only.
const CODE_PREFIXES = [
  "/admin/scan",
  "/api/admin/checkin",
  "/api/admin/orders", // helpers only; the routes themselves check the role
];
// Matched exactly, otherwise "/admin" would open the whole admin area.
const CODE_EXACT = ["/admin"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPath = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAdminApiPath =
    pathname.startsWith("/api/admin") &&
    pathname !== "/api/admin/login" &&
    pathname !== "/api/admin/logout";

  if (!isAdminPath && !isAdminApiPath) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = process.env.ADMIN_SESSION_SECRET;
  const isAdmin = !!expected && sessionCookie === expected;

  if (isAdmin) return NextResponse.next();

  // This runs before the app and has no database access, so it can only see
  // whether a scanner cookie is present. The code inside it is verified
  // against the database by getRole() in the scanner's own page and route —
  // a forged cookie gets no further than this.
  const hasScannerCookie = !!req.cookies.get(SCANNER_COOKIE)?.value;
  const isCodePath =
    CODE_EXACT.includes(pathname) || CODE_PREFIXES.some((p) => pathname.startsWith(p));

  if (hasScannerCookie) {
    if (isCodePath) return NextResponse.next();
    // A volunteer who lands on another admin page goes to the one page they
    // do have: the scanner.
    if (isAdminApiPath) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/admin/scan", req.url));
  }

  if (isAdminApiPath) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/login", req.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
