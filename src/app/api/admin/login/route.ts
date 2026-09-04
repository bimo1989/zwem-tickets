import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!expectedPassword || !sessionSecret) {
    return NextResponse.json(
      { error: "Server niet correct geconfigureerd." },
      { status: 500 }
    );
  }

  const provided = Buffer.from(String(password ?? ""));
  const expected = Buffer.from(expectedPassword);

  const isMatch =
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);

  if (!isMatch) {
    return NextResponse.json({ error: "Ongeldig wachtwoord." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", sessionSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}
