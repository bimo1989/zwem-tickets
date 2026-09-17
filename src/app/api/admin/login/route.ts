import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  SCANNER_COOKIE,
  SCANNER_SESSION_MAX_AGE,
  findScannerCode,
  isAdminPassword,
  touchScannerCode,
} from "@/lib/auth";

/**
 * One field, two kinds of sign-in: the admin password gives full access, a
 * volunteer's scan code gives the check-in scanner and nothing else.
 */
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const provided = String(password ?? "");
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!process.env.ADMIN_PASSWORD || !sessionSecret) {
    return NextResponse.json(
      { error: "Server niet correct geconfigureerd." },
      { status: 500 }
    );
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  if (isAdminPassword(provided)) {
    const res = NextResponse.json({ ok: true, role: "admin", redirectTo: "/admin" });
    res.cookies.set(ADMIN_COOKIE, sessionSecret, {
      ...cookieOptions,
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
    return res;
  }

  const scannerCode = await findScannerCode(provided);
  if (scannerCode) {
    await touchScannerCode(scannerCode.id);
    const res = NextResponse.json({
      ok: true,
      role: "scanner",
      redirectTo: "/admin/scan",
    });
    res.cookies.set(SCANNER_COOKIE, scannerCode.code, {
      ...cookieOptions,
      maxAge: SCANNER_SESSION_MAX_AGE,
    });
    return res;
  }

  return NextResponse.json(
    { error: "Ongeldig wachtwoord of scan-code." },
    { status: 401 }
  );
}
