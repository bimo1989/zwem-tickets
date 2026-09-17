import { createMollieClient, type MollieClient } from "@mollie/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, type EventRow, type OrderRow } from "@/lib/supabase";
import { sendTicketEmail } from "@/lib/email";

export type MollieConfig = {
  apiKey: string | null;
  /** Whether the admin wants online payments offered at all. */
  enabled: boolean;
  /** Where the key came from — the admin settings, or the legacy env var. */
  source: "settings" | "env" | null;
  mode: "test" | "live" | null;
};

/** Mollie keys look like `test_` or `live_` followed by ~30 alphanumerics. */
export const MOLLIE_KEY_PATTERN = /^(test|live)_[A-Za-z0-9]{24,}$/;

export function mollieKeyMode(apiKey: string): "test" | "live" | null {
  if (apiKey.startsWith("test_")) return "test";
  if (apiKey.startsWith("live_")) return "live";
  return null;
}

/** `test_abcd…wxyz` — enough to recognise a key, not enough to use it. */
export function maskMollieKey(apiKey: string): string {
  return `${apiKey.slice(0, 9)}…${apiKey.slice(-4)}`;
}

// Server-only. The key lives in app_settings (managed from /admin/settings),
// with MOLLIE_API_KEY as a fallback for installs that were set up before the
// key moved into the database. Never expose either to the browser.
export async function getMollieConfig(client?: SupabaseClient): Promise<MollieConfig> {
  const supabase = client ?? getSupabaseAdmin();

  // An error here means the 0009 migration hasn't run yet — fall back to the
  // environment variable instead of breaking checkout.
  const { data } = await supabase
    .from("app_settings")
    .select("mollie_api_key, mollie_enabled")
    .eq("id", true)
    .maybeSingle();

  const settingsKey = data?.mollie_api_key?.trim() || null;
  const envKey = process.env.MOLLIE_API_KEY?.trim() || null;
  const apiKey = settingsKey ?? envKey;

  return {
    apiKey,
    // `mollie_enabled` defaults to true, so an install that only has the env
    // key behaves exactly as it did before.
    enabled: data ? data.mollie_enabled : true,
    source: settingsKey ? "settings" : envKey ? "env" : null,
    mode: apiKey ? mollieKeyMode(apiKey) : null,
  };
}

/** True when online payment can actually be offered to a buyer. */
export async function isMollieAvailable(client?: SupabaseClient): Promise<boolean> {
  const { apiKey, enabled } = await getMollieConfig(client);
  return enabled && !!apiKey;
}

export async function getMollieClient(client?: SupabaseClient): Promise<MollieClient> {
  const { apiKey } = await getMollieConfig(client);
  if (!apiKey) {
    throw new Error(
      "Geen Mollie API-sleutel geconfigureerd — stel die in via /admin/settings."
    );
  }
  return createMollieClient({ apiKey });
}

export function formatEuroCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

const MOLLIE_STATUS_MAP: Record<string, OrderRow["status"]> = {
  paid: "paid",
  expired: "expired",
  canceled: "canceled",
  failed: "failed",
};

/**
 * Ask Mollie for the authoritative status of an order's payment and write it
 * to the order. Used by the webhook and by the ticket page's status poll, so a
 * buyer still gets confirmed if the webhook is delayed or can't reach us
 * (e.g. during local development).
 *
 * Returns the order's status after syncing.
 */
export async function syncMolliePayment(
  supabase: SupabaseClient,
  order: OrderRow
): Promise<OrderRow["status"]> {
  if (!order.mollie_payment_id) return order.status;

  const mollie = await getMollieClient(supabase);
  // Always re-fetch from Mollie rather than trusting a webhook body — this is
  // the documented, tamper-proof way to confirm a payment.
  const payment = await mollie.payments.get(order.mollie_payment_id);

  return applyMolliePaymentStatus(supabase, order, payment.status);
}

export async function applyMolliePaymentStatus(
  supabase: SupabaseClient,
  order: OrderRow,
  mollieStatus: string
): Promise<OrderRow["status"]> {
  const newStatus = MOLLIE_STATUS_MAP[mollieStatus] ?? order.status;
  if (newStatus === order.status) return order.status;

  // Conditional on the status we read, so whoever wins the race between the
  // webhook and the ticket page poll is the only one that sends the email.
  const { data: updated } = await supabase
    .from("orders")
    .update({
      status: newStatus,
      paid_at: newStatus === "paid" ? new Date().toISOString() : order.paid_at,
    })
    .eq("id", order.id)
    .eq("status", order.status)
    .select()
    .maybeSingle();

  if (!updated) return newStatus; // lost the race; the winner handles the mail

  if (newStatus === "paid") {
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", order.event_id)
      .maybeSingle();

    if (event) {
      try {
        await sendTicketEmail(event as EventRow, updated as OrderRow);
      } catch (err) {
        console.error("Failed to send ticket email:", err);
      }
    }
  }

  return newStatus;
}
