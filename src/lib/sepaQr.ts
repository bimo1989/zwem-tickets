import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSettingsRow, BankAccountRow, EventRow } from "./supabase";

// Generates the payload for an "EPC QR code" (a.k.a. SEPA payment QR / the
// same kind you see on Belgian/EU invoices). It's a plain-text format
// defined by the European Payments Council (EPC069-12) that a BANKING APP's
// own QR scanner knows how to turn into a pre-filled bank transfer. It is
// NOT a URL, so a phone's regular camera app can't do anything special with
// it — only a bank app's dedicated "scan to pay" feature recognizes it.
//
// Field order matters. Trailing empty fields may be omitted, but empty
// fields *before* a later non-empty one must stay as blank lines.
export function buildEpcQrPayload({
  beneficiaryName,
  iban,
  bic,
  amountCents,
  remittanceInfo,
}: {
  beneficiaryName: string;
  iban: string;
  bic?: string | null;
  amountCents: number;
  remittanceInfo: string;
}): string {
  const amount = (amountCents / 100).toFixed(2);

  const lines = [
    "BCD", // Service tag
    "002", // Version
    "1", // Character set: UTF-8
    "SCT", // SEPA Credit Transfer
    (bic ?? "").replace(/\s+/g, "").toUpperCase(), // Beneficiary BIC (optional within SEPA)
    beneficiaryName.slice(0, 70),
    iban.replace(/\s+/g, "").toUpperCase(),
    `EUR${amount}`,
    "", // Purpose code (unused)
    "", // Structured remittance info (unused, we use unstructured below)
    remittanceInfo.slice(0, 140),
  ];

  return lines.join("\n");
}

// Fetches the bank account an event should be paid into, or null if the
// event has none configured (bank transfer unavailable for that event).
export async function getBankAccountForEvent(
  supabase: SupabaseClient,
  event: Pick<EventRow, "bank_account_id">
): Promise<BankAccountRow | null> {
  if (!event.bank_account_id) return null;

  const { data } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("id", event.bank_account_id)
    .maybeSingle();

  return (data as BankAccountRow | null) ?? null;
}

export async function getRemittanceTemplate(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("remittance_template")
    .eq("id", true)
    .maybeSingle();

  return (data as AppSettingsRow | null)?.remittance_template ?? "{nummer} - {evenement} - {naam}";
}

// Fills in a remittance template with an order's details. Supported tokens:
// {nummer} — the order's sequential number, {evenement} — the event title,
// {naam} — the buyer's name.
export function renderRemittanceTemplate(
  template: string,
  vars: { nummer: number | string; evenement: string; naam: string }
): string {
  const filled = template
    .replaceAll("{nummer}", String(vars.nummer))
    .replaceAll("{evenement}", vars.evenement)
    .replaceAll("{naam}", vars.naam);

  return filled.slice(0, 140);
}
