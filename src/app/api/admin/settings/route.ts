import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMollieClient } from "@mollie/api-client";
import {
  getSupabaseAdmin,
  type AppSettingsRow,
  type PublicAppSettings,
} from "@/lib/supabase";
import {
  MOLLIE_KEY_PATTERN,
  getMollieConfig,
  maskMollieKey,
  mollieKeyMode,
} from "@/lib/mollie";

const settingsSchema = z
  .object({
    remittance_template: z
      .string()
      .trim()
      .min(1)
      .max(140)
      .refine(
        (t) => t.includes("{nummer}") || t.includes("{evenement}") || t.includes("{naam}"),
        "Gebruik minstens één van de plaatshouders: {nummer}, {evenement}, {naam}."
      )
      .optional(),
    mollie_enabled: z.boolean().optional(),
    // A string sets a new key, null clears the stored one.
    mollie_api_key: z
      .union([
        z
          .string()
          .trim()
          .regex(
            MOLLIE_KEY_PATTERN,
            "Dit lijkt geen Mollie API-sleutel. Die begint met test_ of live_."
          ),
        z.null(),
      ])
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Geen wijzigingen meegegeven.");

/**
 * The stored Mollie key must never reach the browser, so the admin UI only
 * ever sees a masked hint of it.
 */
async function buildPublicSettings(
  row: Pick<AppSettingsRow, "remittance_template"> | null
): Promise<PublicAppSettings> {
  const mollie = await getMollieConfig();
  return {
    remittance_template: row?.remittance_template ?? "",
    mollie_enabled: mollie.enabled,
    mollie_key_hint: mollie.apiKey ? maskMollieKey(mollie.apiKey) : null,
    mollie_mode: mollie.mode,
    mollie_key_source: mollie.source,
  };
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .select("remittance_template")
    .eq("id", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: await buildPublicSettings(data) });
}

export async function PATCH(req: NextRequest) {
  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag." },
      { status: 400 }
    );
  }

  const updates = parsed.data;

  // Before storing a new key, let Mollie confirm it actually works — a typo or
  // a revoked key would otherwise only surface when a buyer tries to pay.
  let mollieCheck: { mode: "test" | "live" | null; methods: string[] } | null = null;
  if (typeof updates.mollie_api_key === "string") {
    try {
      const methods = await createMollieClient({
        apiKey: updates.mollie_api_key,
      }).methods.list();
      mollieCheck = {
        mode: mollieKeyMode(updates.mollie_api_key),
        methods: methods.map((m) => m.description),
      };
    } catch (err) {
      console.error("Mollie key verification failed:", err);
      return NextResponse.json(
        {
          error:
            "Mollie weigert deze sleutel. Controleer of je ze volledig hebt gekopieerd uit Dashboard → Developers → API keys.",
        },
        { status: 400 }
      );
    }
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .update(updates)
    .eq("id", true)
    .select("remittance_template")
    .single();

  if (error) {
    // The Mollie columns only exist after migration 0009 — say so instead of
    // showing a raw Postgres error.
    if (error.message.includes("mollie_")) {
      return NextResponse.json(
        {
          error:
            "De database kent de Mollie-instellingen nog niet. Run supabase/migrations/0009_mollie_settings.sql in de Supabase SQL Editor en probeer opnieuw.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: await buildPublicSettings(data),
    mollieCheck,
  });
}
