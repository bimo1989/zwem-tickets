import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the service-role key, which has full access to
// the database and bypasses Row Level Security. NEVER import this file from
// client components, and never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  price_cents: number;
  member_price_cents: number | null;
  capacity: number;
  bank_account_id: string | null;
  is_published: boolean;
  created_at: string;
};

export type OrderRow = {
  id: string;
  order_number: number;
  event_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  quantity: number;
  is_member: boolean;
  amount_cents: number;
  status: "open" | "paid" | "expired" | "canceled" | "failed";
  payment_method: "mollie" | "bank_transfer";
  mollie_payment_id: string | null;
  checked_in_count: number;
  ticket_code: string;
  created_at: string;
  paid_at: string | null;
};

export type BankAccountRow = {
  id: string;
  label: string;
  account_holder: string;
  iban: string;
  bic: string | null;
  is_default: boolean;
  created_at: string;
};

export type AppSettingsRow = {
  id: true;
  remittance_template: string;
};

export type EventSalesRow = {
  event_id: string;
  title: string;
  capacity: number;
  tickets_paid: number;
  tickets_pending: number;
  revenue_cents: number;
};
