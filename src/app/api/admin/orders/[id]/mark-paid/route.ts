import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendTicketEmail } from "@/lib/email";

// Manual confirmation for bank-transfer orders: an admin has seen the
// matching transfer land in the bank account and confirms it here.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }

  if (order.status === "paid") {
    return NextResponse.json({ order });
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Kon bestelling niet bijwerken." }, { status: 500 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", updated.event_id)
    .maybeSingle();

  if (event) {
    try {
      await sendTicketEmail(event, updated);
    } catch (err) {
      console.error("Failed to send ticket email:", err);
    }
  }

  return NextResponse.json({ order: updated });
}
