import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Ongeldige tijd"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "Ongeldige tijd"),
  location: z.string().trim().max(300).optional().or(z.literal("")),
  price_cents: z.coerce.number().int().min(0),
  member_price_cents: z.coerce.number().int().min(0).nullable().optional(),
  capacity: z.coerce.number().int().min(1),
  bank_account_id: z.string().uuid().nullable().optional(),
  is_published: z.boolean().optional(),
}).refine(
  (data) =>
    data.member_price_cents == null || data.member_price_cents <= data.price_cents,
  { message: "Ledenprijs mag niet hoger zijn dan de gewone prijs.", path: ["member_price_cents"] }
);

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}

export async function POST(req: NextRequest) {
  const parsed = eventSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag." },
      { status: 400 }
    );
  }

  const { description, location, ...rest } = parsed.data;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("events")
    .insert({
      ...rest,
      description: description || null,
      location: location || null,
      is_published: parsed.data.is_published ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event: data });
}
