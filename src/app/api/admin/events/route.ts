import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const priceTierSchema = z.object({
  label: z.string().trim().min(1).max(50),
  price_cents: z.coerce.number().int().min(0),
});

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Ongeldige tijd"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Ongeldige tijd"),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  price_tiers: z.array(priceTierSchema).min(1, "Voeg minstens 1 prijscategorie toe."),
  capacity: z.coerce.number().int().min(1),
  registration_deadline: z.string().trim().nullable().optional(),
  bank_account_id: z.string().uuid().nullable().optional(),
  is_published: z.boolean().optional(),
});

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("*, event_price_tiers(*)")
    .order("event_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}

export async function POST(req: NextRequest) {
  const parsed = eventSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag." },
      { status: 400 }
    );
  }

  const { description, location, price_tiers, registration_deadline, ...rest } = parsed.data;
  const supabase = getSupabaseAdmin();
  const lowestPriceCents = Math.min(...price_tiers.map((t) => t.price_cents));

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      ...rest,
      description: description || null,
      location: location || null,
      registration_deadline: registration_deadline || null,
      price_cents: lowestPriceCents,
      is_published: parsed.data.is_published ?? true,
    })
    .select()
    .single();

  if (eventError || !event) {
    return NextResponse.json(
      { error: eventError?.message ?? "Kon evenement niet aanmaken." },
      { status: 500 }
    );
  }

  const { error: tiersError } = await supabase.from("event_price_tiers").insert(
    price_tiers.map((tier, index) => ({
      event_id: event.id,
      label: tier.label,
      price_cents: tier.price_cents,
      display_order: index,
    }))
  );

  if (tiersError) {
    // Roll back the event so we don't leave a priceless orphan behind.
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json({ error: tiersError.message }, { status: 500 });
  }

  return NextResponse.json({ event });
}
