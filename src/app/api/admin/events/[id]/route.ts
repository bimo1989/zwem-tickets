import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  location: z.string().trim().max(300).nullable().optional(),
  price_cents: z.coerce.number().int().min(0).optional(),
  member_price_cents: z.coerce.number().int().min(0).nullable().optional(),
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
  const { data, error } = await supabase
    .from("events")
    .update(parsed.data)
    .eq("id", id)
    .select()
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

  // Refuse to delete an event that already has orders against it — cancel
  // (unpublish) it instead so past tickets/history stay intact.
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      {
        error:
          "Dit evenement heeft al bestellingen en kan niet verwijderd worden. Zet het op 'niet gepubliceerd' in plaats daarvan.",
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
