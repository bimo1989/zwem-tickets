import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const waitlistSchema = z.object({
  eventId: z.string().uuid(),
  buyerName: z.string().trim().min(1).max(200),
  buyerEmail: z.string().trim().email().max(320),
  buyerPhone: z.string().trim().min(6).max(30),
  quantity: z.coerce.number().int().min(1).max(10),
});

export async function POST(req: NextRequest) {
  const parsed = waitlistSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const { eventId, buyerName, buyerEmail, buyerPhone, quantity } = parsed.data;

  const supabase = getSupabaseAdmin();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .eq("is_published", true)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ error: "Evenement niet gevonden." }, { status: 404 });
  }

  if (!event.waitlist_enabled) {
    return NextResponse.json(
      { error: "Er is geen wachtlijst beschikbaar voor dit evenement." },
      { status: 400 }
    );
  }

  const { data: order, error: insertError } = await supabase
    .from("waitlist_entries")
    .insert({
      event_id: eventId,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      quantity,
    })
    .select()
    .single();

  if (insertError || !order) {
    console.error("Waitlist insert failed:", insertError);
    return NextResponse.json(
      { error: "Kon inschrijving op de wachtlijst niet opslaan." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
