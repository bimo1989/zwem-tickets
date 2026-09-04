import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const priceTierSchema = z.object({
  label: z.string().trim().min(1).max(50),
  price_cents: z.coerce.number().int().min(0),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().trim().max(300).nullable().optional(),
  price_tiers: z.array(priceTierSchema).min(1).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  is_published: z.boolean().optional(),
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
  const { price_tiers, ...eventFields } = parsed.data;

  if (price_tiers) {
    // Replace the full tier list rather than diffing — simplest to reason
    // about, and tier ids aren't referenced elsewhere (orders snapshot the
    // label + amount instead of pointing at a tier row).
    const { error: deleteError } = await supabase
      .from("event_price_tiers")
      .delete()
      .eq("event_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { error: insertError } = await supabase.from("event_price_tiers").insert(
      price_tiers.map((tier, index) => ({
        event_id: id,
        label: tier.label,
        price_cents: tier.price_cents,
        display_order: index,
      }))
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    (eventFields as { price_cents?: number }).price_cents = Math.min(
      ...price_tiers.map((t) => t.price_cents)
    );
  }

  const { data, error } = await supabase
    .from("events")
    .update(eventFields)
    .eq("id", id)
    .select("*, event_price_tiers(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // Deleting an event cascades to its orders and price tiers (see
  // supabase/schema.sql). The admin UI requires typing a confirmation
  // phrase before calling this, since it's permanent and takes
  // ticket/sales history with it.
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
