import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, type EventAgreementRow } from "@/lib/supabase";
import { getRole } from "@/lib/auth";

const createSchema = z.object({
  text: z.string().trim().min(1).max(600),
});

const MIGRATION_HINT =
  "De database kent het reglement nog niet. Run supabase/migrations/0014_event_rules.sql in de Supabase SQL Editor en probeer opnieuw.";

function isMissingTable(message: string): boolean {
  return message.includes("event_agreements");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("event_agreements")
    .select("*")
    .eq("event_id", id)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: isMissingTable(error.message) ? MIGRATION_HINT : error.message },
      { status: isMissingTable(error.message) ? 409 : 500 }
    );
  }

  return NextResponse.json({ agreements: (data ?? []) as EventAgreementRow[] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vul de tekst van het vinkje in (max 600 tekens)." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  // New items go to the bottom of the list.
  const { data: last } = await supabase
    .from("event_agreements")
    .select("display_order")
    .eq("event_id", id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("event_agreements")
    .insert({
      event_id: id,
      text: parsed.data.text,
      display_order: (last?.display_order ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: isMissingTable(error.message) ? MIGRATION_HINT : error.message },
      { status: isMissingTable(error.message) ? 409 : 500 }
    );
  }

  return NextResponse.json({ agreement: data as EventAgreementRow });
}
