import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, type EventAgreementRow } from "@/lib/supabase";
import { getRole } from "@/lib/auth";

const updateSchema = z.object({
  text: z.string().trim().min(1).max(600).optional(),
  display_order: z.coerce.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; agreementId: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { id, agreementId } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("event_agreements")
    .update(parsed.data)
    .eq("id", agreementId)
    .eq("event_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ agreement: data as EventAgreementRow });
}

/**
 * Removing a checkbox only affects future orders: what earlier buyers agreed
 * to is snapshotted on their own order, so deleting this never rewrites
 * history.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; agreementId: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, agreementId } = await params;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("event_agreements")
    .delete()
    .eq("id", agreementId)
    .eq("event_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
