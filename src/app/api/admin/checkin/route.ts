import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRole } from "@/lib/auth";

const checkinSchema = z.object({
  ticketCode: z.string().trim().min(1).max(64),
});

export async function POST(req: NextRequest) {
  // Admins and volunteers with a scan code may both check people in. proxy.ts
  // lets a scanner cookie through without being able to validate it, so the
  // code inside it is verified here.
  const role = await getRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      order: role === "admin" ? order : undefined,
    });
  }

  if (order.checked_in_count >= order.quantity) {
    return NextResponse.json({
      status: "already_used",
      message: `Al volledig ingecheckt (${order.checked_in_count}/${order.quantity}).`,
      order: role === "admin" ? order : undefined,
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
    order: role === "admin" ? updated : undefined,
  });
}
