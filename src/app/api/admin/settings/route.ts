import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";

const settingsSchema = z.object({
  remittance_template: z
    .string()
    .trim()
    .min(1)
    .max(140)
    .refine(
      (t) => t.includes("{nummer}") || t.includes("{evenement}") || t.includes("{naam}"),
      "Gebruik minstens één van de plaatshouders: {nummer}, {evenement}, {naam}."
    ),
});

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(req: NextRequest) {
  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .update(parsed.data)
    .eq("id", true)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
