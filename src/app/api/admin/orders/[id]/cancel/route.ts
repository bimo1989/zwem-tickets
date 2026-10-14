import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRole } from "@/lib/auth";

/**
 * Cancels an order that was never paid, which is what frees the spot: the
 * capacity check at checkout counts paid and open orders, so an abandoned
 * bank transfer would otherwise block a seat forever.
 *
 * The order is kept (status "canceled") rather than deleted, so the history
 * stays intact — and marking it paid later still works if the money turns up
 * after all.
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
  if (order.status === "paid") {
    return NextResponse.json(
      { error: "Deze bestelling is betaald. Annuleren zou een geldig ticket intrekken." },
      { status: 409 }
    );
  }
  if (order.status === "canceled") {
    return NextResponse.json({ order });
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: "canceled" })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: updated });
}
