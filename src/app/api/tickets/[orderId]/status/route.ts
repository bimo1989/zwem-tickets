import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, type OrderRow } from "@/lib/supabase";
import { syncMolliePayment } from "@/lib/mollie";

// Polled by the ticket page while a payment is still open, so the buyer sees
// the confirmation appear by itself instead of having to refresh.
//
// Public, like the ticket page itself: the order id is an unguessable UUID and
// the response says nothing beyond the payment status.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }

  let status = (order as OrderRow).status;

  // Ask Mollie directly rather than waiting for its webhook. That keeps the
  // confirmation working when the webhook is delayed, or can't reach us at all
  // (local development on localhost).
  if (status === "open" && order.payment_method === "mollie" && order.mollie_payment_id) {
    try {
      status = await syncMolliePayment(supabase, order as OrderRow);
    } catch (err) {
      console.error("Mollie status sync failed:", err);
    }
  }

  return NextResponse.json({ status });
}
