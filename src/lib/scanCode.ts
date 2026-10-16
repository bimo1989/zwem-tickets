// Pure helpers around a volunteer's scan code. Kept separate from auth.ts so
// client components can import them without pulling in next/headers, node
// crypto or the Supabase service-role client.

/**
 * What a volunteer code grants. 'scanner' is the check-in camera and nothing
 * else; 'helper' adds the ticket overview, the WhatsApp buttons and
 * cancelling an unpaid order.
 */
export type ScanCodeRole = "scanner" | "helper";

export const SCAN_CODE_ROLE_LABELS: Record<ScanCodeRole, string> = {
  scanner: "Enkel scannen",
  helper: "Opvolging + scannen",
};

export type ScannerCodeRow = {
  id: string;
  label: string;
  code: string;
  role: ScanCodeRole;
  created_at: string;
  last_used_at: string | null;
};

// No 0/O/1/I, so a code stays readable when it's written on a slip of paper
// or read out over the phone.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** Accepts "7k4m-9qx2", "7K4M 9QX2" and "7k4m9qx2" as the same code. */
export function normalizeScanCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Cosmetic only — codes are stored and compared without the dash. */
export function formatScanCode(code: string): string {
  return code.length === CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
