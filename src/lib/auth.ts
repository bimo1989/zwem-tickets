import { cookies } from "next/headers";
import { randomInt, timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  normalizeScanCode,
  type ScannerCodeRow,
} from "@/lib/scanCode";

export const ADMIN_COOKIE = "admin_session";
export const SCANNER_COOKIE = "scanner_session";

export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
// A volunteer's shift can run a whole evening, so don't log them out halfway.
export const SCANNER_SESSION_MAX_AGE = 60 * 60 * 12;

export type Role = "admin" | "scanner";

export function generateScanCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function isAdminPassword(provided: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Looks up a scan code and, when it matches, records that it was used so an
 * admin can see which codes are live.
 */
export async function findScannerCode(rawCode: string): Promise<ScannerCodeRow | null> {
  const code = normalizeScanCode(rawCode);
  if (code.length === 0) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("scanner_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  return (data as ScannerCodeRow) ?? null;
}

export async function touchScannerCode(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("scanner_codes")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * The role of the current request, or null when not signed in.
 *
 * `proxy.ts` is the coarse gate — it can only see that a cookie is present,
 * because it has no database access. This is where a scanner cookie is
 * actually verified, so every scanner-reachable route and page must call it.
 */
export async function getRole(): Promise<Role | null> {
  const jar = await cookies();

  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const adminCookie = jar.get(ADMIN_COOKIE)?.value;
  if (sessionSecret && adminCookie === sessionSecret) return "admin";

  const scannerCookie = jar.get(SCANNER_COOKIE)?.value;
  if (scannerCookie) {
    const row = await findScannerCode(scannerCookie);
    if (row) return "scanner";
  }

  return null;
}
