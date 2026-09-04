import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMollieClient } from "@/lib/mollie";
import { sendTicketEmail } from "@/lib/email";

// Mollie calls this endpoint (server-to-server) whenever a payment's status
// changes. It sends `id` as application/x-www-form-urlencoded.
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let paymentId: string | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    paymentId = form.get("id")?.toString() ?? null;
  } else {
    try {
      const body = await req.json();
      paymentId = body?.id ?? null;
    } catch {
      // ignore
    }
  }

  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  }

  const mollie = getMollieClient();
  const supabase = getSupabaseAdmin();

  // Always re-fetch the payment from Mollie rather than trusting the webhook
  // body — this is the documented, tamper-proof way to confirm status.
  const payment = await mollie.payments.get(paymentId);

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("mollie_payment_id", paymentId)
    .maybeSingle();

  if (!order) {
    // Unknown payment — acknowledge so Mollie stops retrying.
    return NextResponse.json({ received: true });
  }

  const wasAlreadyPaid = order.status === "paid";

  let newStatus = order.status;
  if (payment.status === "paid") newStatus = "paid";
  else if (payment.status === "expired") newStatus = "expired";
  else if (payment.status === "canceled") newStatus = "canceled";
  else if (payment.status === "failed") newStatus = "failed";

  if (newStatus !== order.status) {
    await supabase
      .from("orders")
      .update({
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : order.paid_at,
      })
      .eq("id", order.id);
  }

  if (newStatus === "paid" && !wasAlreadyPaid) {
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", order.event_id)
      .maybeSingle();

    if (event) {
      try {
        await sendTicketEmail(event, { ...order, status: "paid" });
      } catch (err) {
        console.error("Failed to send ticket email:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
