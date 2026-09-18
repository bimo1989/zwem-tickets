import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, type EventRow, type OrderRow } from "@/lib/supabase";
import { sendTicketEmail } from "@/lib/email";
import { getRole } from "@/lib/auth";

/**
 * Sends the confirmation mail for one order again — for when it failed the
 * first time (Resend's free tier stops at 100 mails a day) or the buyer lost
 * it.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Deze bestelling is niet betaald, dus er is nog geen ticket." },
      { status: 409 }
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", order.event_id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Evenement niet gevonden." }, { status: 404 });
  }

  try {
    await sendTicketEmail(event as EventRow, order as OrderRow, supabase);
  } catch (err) {
    console.error("Resending ticket email failed:", err);
    const message = err instanceof Error ? err.message : "Versturen mislukt.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: updated } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return NextResponse.json({ order: updated });
}
