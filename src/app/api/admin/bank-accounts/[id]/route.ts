import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const updateSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  account_holder: z.string().trim().min(1).max(200).optional(),
  iban: z.string().trim().min(10).max(50).optional(),
  bic: z.string().trim().max(20).nullable().optional(),
  is_default: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (parsed.data.is_default) {
    await supabase
      .from("bank_accounts")
      .update({ is_default: false })
      .eq("is_default", true)
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bankAccount: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { count } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("bank_account_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      {
        error: `Deze rekening wordt nog gebruikt door ${count} evenement(en). Koppel die eerst aan een andere rekening.`,
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
