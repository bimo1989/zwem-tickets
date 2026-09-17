import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, type OrderRow } from "@/lib/supabase";
import { syncMolliePayment } from "@/lib/mollie";

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

  const supabase = getSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("mollie_payment_id", paymentId)
    .maybeSingle();

  if (!order) {
    // Unknown payment — acknowledge so Mollie stops retrying.
    return NextResponse.json({ received: true });
  }

  // Re-fetches the payment from Mollie, updates the order and sends the
  // ticket email on the first transition to paid.
  await syncMolliePayment(supabase, order as OrderRow);

  return NextResponse.json({ received: true });
}
