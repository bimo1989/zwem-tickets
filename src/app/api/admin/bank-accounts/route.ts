import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const bankAccountSchema = z.object({
  label: z.string().trim().min(1).max(100),
  account_holder: z.string().trim().min(1).max(200),
  iban: z.string().trim().min(10).max(50),
  bic: z.string().trim().max(20).optional().or(z.literal("")),
  is_default: z.boolean().optional().default(false),
});

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bankAccounts: data });
}

export async function POST(req: NextRequest) {
  const parsed = bankAccountSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { bic, is_default, ...rest } = parsed.data;

  // Only one account can be the default at a time.
  if (is_default) {
    await supabase.from("bank_accounts").update({ is_default: false }).eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({ ...rest, bic: bic || null, is_default })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bankAccount: data });
}
