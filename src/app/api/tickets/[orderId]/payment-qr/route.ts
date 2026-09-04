import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSupabaseAdmin, type EventRow } from "@/lib/supabase";
import {
  buildEpcQrPayload,
  getBankAccountForEvent,
  getRemittanceTemplate,
  renderRemittanceTemplate,
} from "@/lib/sepaQr";

// Serves the bank-transfer payment QR as a real image URL (instead of only
// an inline data: URI) so it can be opened, saved, or forwarded to another
// device to scan — useful since you can't scan a QR with the same phone
// that's displaying it.
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

  if (!order || order.payment_method !== "bank_transfer") {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", order.event_id)
    .maybeSingle();

  const bankAccount = event
    ? await getBankAccountForEvent(supabase, event as EventRow)
    : null;

  if (!event || !bankAccount) {
    return new NextResponse("Not found", { status: 404 });
  }

  const template = await getRemittanceTemplate(supabase);
  const remittanceInfo = renderRemittanceTemplate(template, {
    nummer: order.order_number,
    evenement: event.title,
    naam: order.buyer_name,
  });

  const qrPayload = buildEpcQrPayload({
    beneficiaryName: bankAccount.account_holder,
    iban: bankAccount.iban,
    bic: bankAccount.bic,
    amountCents: order.amount_cents,
    remittanceInfo,
  });

  const buffer = await QRCode.toBuffer(qrPayload, {
    width: 600,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      // Not public: it's a payment QR tied to one order. Fine to cache
      // briefly per-viewer, but don't let shared/CDN caches serve it cross-user.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
