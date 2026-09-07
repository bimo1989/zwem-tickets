import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [{ data: events, error: eventsError }, { data: entries, error: entriesError }] =
    await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: false }),
      supabase.from("waitlist_entries").select("*").order("created_at", { ascending: true }),
    ]);

  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

  return NextResponse.json({ events, entries });
}
