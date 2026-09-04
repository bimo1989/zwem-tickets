import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const checkinSchema = z.object({
  ticketCode: z.string().trim().min(1).max(64),
});

export async function POST(req: NextRequest) {
  const parsed = checkinSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige QR-code." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, events(title)")
    .eq("ticket_code", parsed.data.ticketCode)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json(
      { status: "invalid", message: "Onbekende ticketcode." },
      { status: 404 }
    );
  }

  if (order.status !== "paid") {
    return NextResponse.json({
      status: "unpaid",
      message: `Niet betaald (${order.status}) — toegang weigeren.`,
      order,
    });
  }

  if (order.checked_in_count >= order.quantity) {
    return NextResponse.json({
      status: "already_used",
      message: `Al volledig ingecheckt (${order.checked_in_count}/${order.quantity}).`,
      order,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ checked_in_count: order.checked_in_count + 1 })
    .eq("id", order.id)
    .select("*, events(title)")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    status: "ok",
    message: `Welkom, ${updated.buyer_name}! (${updated.checked_in_count}/${updated.quantity})`,
    order: updated,
  });
}
