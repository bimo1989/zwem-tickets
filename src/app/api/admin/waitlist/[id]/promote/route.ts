import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getBankAccountForEvent } from "@/lib/sepaQr";

const promoteSchema = z.object({
  priceTierId: z.string().uuid(),
});

// Converts a waitlist sign-up into a real order once a spot frees up. The
// admin picks which price category applies; the resulting order always uses
// bank transfer, since it's created outside of the buyer's own checkout
// flow (no live Mollie session to hand them) — the admin then forwards the
// payment link, e.g. via the WhatsApp reminder button in the ticket overview.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsed = promoteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: entry, error: entryError } = await supabase
    .from("waitlist_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (entryError || !entry) {
    return NextResponse.json({ error: "Wachtlijst-inschrijving niet gevonden." }, { status: 404 });
  }

  if (entry.promoted_order_id) {
    return NextResponse.json(
      { error: "Deze inschrijving is al omgezet naar een bestelling." },
      { status: 409 }
    );
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", entry.event_id)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ error: "Evenement niet gevonden." }, { status: 404 });
  }

  const bankAccount = await getBankAccountForEvent(supabase, event);
  if (!bankAccount) {
    return NextResponse.json(
      {
        error:
          "Dit evenement heeft geen rekening voor overschrijvingen ingesteld. Voeg er eerst één toe bij het evenement.",
      },
      { status: 400 }
    );
  }

  const { data: priceTier } = await supabase
    .from("event_price_tiers")
    .select("*")
    .eq("id", parsed.data.priceTierId)
    .eq("event_id", entry.event_id)
    .maybeSingle();

  if (!priceTier) {
    return NextResponse.json({ error: "Ongeldige prijscategorie." }, { status: 400 });
  }

  const amountCents = priceTier.price_cents * entry.quantity;
  const ticketCode = randomBytes(8).toString("hex");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      event_id: entry.event_id,
      buyer_name: entry.buyer_name,
      buyer_email: entry.buyer_email,
      buyer_phone: entry.buyer_phone,
      quantity: entry.quantity,
      price_tier_label: priceTier.label,
      amount_cents: amountCents,
      status: "open",
      payment_method: "bank_transfer",
      ticket_code: ticketCode,
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("Failed to create order from waitlist entry:", orderError);
    return NextResponse.json({ error: "Kon bestelling niet aanmaken." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("waitlist_entries")
    .update({ promoted_order_id: order.id })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ order });
}
