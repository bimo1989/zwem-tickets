import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canFollowUpOrders, getRole } from "@/lib/auth";

export async function GET() {
  // proxy.ts lets any volunteer code through to this path; only an admin or a
  // helper may actually read the registrations.
  const role = await getRole();
  if (!canFollowUpOrders(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  // The page hides the actions this role isn't allowed to use.
  return NextResponse.json({ events, orders, role });
}
