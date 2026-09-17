import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateScanCode, getRole } from "@/lib/auth";
import type { ScannerCodeRow } from "@/lib/scanCode";

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
});

/** Only a full admin may hand out or read the codes. */
async function requireAdmin() {
  const role = await getRole();
  return role === "admin";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scanner_codes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message.includes("scanner_codes")) {
      return NextResponse.json(
        {
          error:
            "De database kent de scan-codes nog niet. Run supabase/migrations/0010_scanner_codes.sql in de Supabase SQL Editor.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scannerCodes: (data ?? []) as ScannerCodeRow[] });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geef een naam op, bv. de voornaam van de vrijwilliger." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // The code is random, so a collision is vanishingly unlikely — but the
  // column is unique, so retry rather than fail on the off chance.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from("scanner_codes")
      .insert({ label: parsed.data.label, code: generateScanCode() })
      .select()
      .single();

    if (!error) {
      return NextResponse.json({ scannerCode: data as ScannerCodeRow });
    }

    // 23505 = unique violation; anything else is a real failure.
    if (error.code !== "23505") {
      if (error.message.includes("scanner_codes")) {
        return NextResponse.json(
          {
            error:
              "De database kent de scan-codes nog niet. Run supabase/migrations/0010_scanner_codes.sql in de Supabase SQL Editor.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Kon geen unieke code genereren. Probeer opnieuw." },
    { status: 500 }
  );
}
