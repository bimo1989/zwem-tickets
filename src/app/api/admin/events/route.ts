import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, type EventRow } from "@/lib/supabase";

/**
 * Copies an event's rules onto a freshly duplicated one: the intro text, the
 * uploaded document (the same file, reused — it isn't edited per event) and a
 * fresh copy of every checkbox.
 */
async function copyRules(
  supabase: SupabaseClient,
  sourceEventId: string,
  targetEventId: string
): Promise<{ event: EventRow | null; warning?: string }> {
  const { data: source, error: sourceError } = await supabase
    .from("events")
    .select("rules_text, rules_file_url")
    .eq("id", sourceEventId)
    .maybeSingle();

  if (sourceError || !source) {
    return { event: null, warning: "Het reglement kon niet gekopieerd worden." };
  }

  const { data: updated } = await supabase
    .from("events")
    .update({
      rules_text: source.rules_text,
      rules_file_url: source.rules_file_url,
    })
    .eq("id", targetEventId)
    .select()
    .single();

  const { data: agreements } = await supabase
    .from("event_agreements")
    .select("text, display_order")
    .eq("event_id", sourceEventId)
    .order("display_order", { ascending: true });

  if (agreements && agreements.length > 0) {
    const { error: insertError } = await supabase.from("event_agreements").insert(
      agreements.map((a) => ({
        event_id: targetEventId,
        text: a.text,
        display_order: a.display_order,
      }))
    );

    if (insertError) {
      return {
        event: (updated as EventRow) ?? null,
        warning: "De vinkjes van het reglement konden niet gekopieerd worden.",
      };
    }
  }

  return { event: (updated as EventRow) ?? null };
}

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
  waitlist_enabled: z.boolean().optional(),
  online_payment_enabled: z.boolean().optional(),
  is_published: z.boolean().optional(),
  /**
   * Set when the admin duplicates an event: the rules (text, document and
   * checkboxes) are copied from that event onto the new one. Copied here on
   * the server rather than carried through the form, because the checkboxes
   * live in their own table.
   */
  duplicate_from_event_id: z.string().uuid().optional(),
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

  const {
    description,
    location,
    price_tiers,
    registration_deadline,
    duplicate_from_event_id: duplicateFromId,
    ...rest
  } = parsed.data;
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

  if (duplicateFromId) {
    const copied = await copyRules(supabase, duplicateFromId, event.id);
    // The event itself is fine without them, so a failure here is reported
    // alongside the new event instead of undoing the whole thing.
    return NextResponse.json({ event: copied.event ?? event, rulesWarning: copied.warning });
  }

  return NextResponse.json({ event });
}
