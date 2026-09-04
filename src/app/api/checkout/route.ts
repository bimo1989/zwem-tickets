import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMollieClient, formatEuroCents } from "@/lib/mollie";
import { getBankAccountForEvent } from "@/lib/sepaQr";

const checkoutSchema = z.object({
  eventId: z.string().uuid(),
  buyerName: z.string().trim().min(1).max(200),
  buyerEmail: z.string().trim().email().max(320),
  buyerPhone: z.string().trim().min(6).max(30),
  quantity: z.coerce.number().int().min(1).max(10),
  isMember: z.boolean().optional().default(false),
  paymentMethod: z.enum(["mollie", "bank_transfer"]).optional().default("mollie"),
});

export async function POST(req: NextRequest) {
  const parsed = checkoutSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const { eventId, buyerName, buyerEmail, buyerPhone, quantity, isMember, paymentMethod } =
    parsed.data;

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

  // Re-check remaining capacity server-side to prevent overselling.
  const { data: sale } = await supabase
    .from("event_sales")
    .select("tickets_paid, tickets_pending")
    .eq("event_id", eventId)
    .maybeSingle();

  const alreadyClaimed = (sale?.tickets_paid ?? 0) + (sale?.tickets_pending ?? 0);
  const remaining = event.capacity - alreadyClaimed;

  if (quantity > remaining) {
    return NextResponse.json(
      { error: `Nog maar ${Math.max(remaining, 0)} plaatsen beschikbaar.` },
      { status: 409 }
    );
  }

  if (paymentMethod === "bank_transfer") {
    const bankAccount = await getBankAccountForEvent(supabase, event);
    if (!bankAccount) {
      return NextResponse.json(
        { error: "Overschrijving is niet beschikbaar voor dit evenement." },
        { status: 400 }
      );
    }
  }

  // Only honor the member checkbox if this event actually has a member
  // price configured; otherwise always charge the regular price.
  const useMemberPrice = isMember && event.member_price_cents != null;
  const unitPriceCents = useMemberPrice
    ? event.member_price_cents!
    : event.price_cents;
  const amountCents = unitPriceCents * quantity;
  const ticketCode = randomBytes(8).toString("hex");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      event_id: eventId,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      quantity,
      is_member: useMemberPrice,
      amount_cents: amountCents,
      status: "open",
      payment_method: paymentMethod,
      ticket_code: ticketCode,
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("Order insert failed:", orderError);
    return NextResponse.json({ error: "Kon bestelling niet aanmaken." }, { status: 500 });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "Server niet correct geconfigureerd." }, { status: 500 });
  }

  // Bank transfer: no third party involved, just send the buyer straight to
  // the ticket page, which shows the payment QR and waits for manual
  // confirmation by an admin.
  if (paymentMethod === "bank_transfer") {
    return NextResponse.json({ checkoutUrl: `${appUrl}/ticket/${order.id}` });
  }

  try {
    const mollie = getMollieClient();
    const payment = await mollie.payments.create({
      amount: { currency: "EUR", value: formatEuroCents(amountCents) },
      description: `${event.title} (${quantity}x)`,
      redirectUrl: `${appUrl}/ticket/${order.id}`,
      webhookUrl: `${appUrl}/api/webhook/mollie`,
      metadata: { orderId: order.id },
    });

    await supabase
      .from("orders")
      .update({ mollie_payment_id: payment.id })
      .eq("id", order.id);

    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) {
      throw new Error("Mollie gaf geen checkout-URL terug.");
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    console.error("Mollie payment creation failed:", err);
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return NextResponse.json({ error: "Kon betaling niet starten." }, { status: 502 });
  }
}
