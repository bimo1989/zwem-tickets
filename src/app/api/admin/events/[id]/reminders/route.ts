import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, type EventRow, type OrderRow } from "@/lib/supabase";
import { sendReminderEmail } from "@/lib/email";
import { getRole } from "@/lib/auth";

const schema = z.object({
  /** Optional line from the admin: what to bring, a changed hall, ... */
  note: z.string().trim().max(600).optional(),
  /** Mail everyone again, including those who already got a reminder. */
  includeAlreadySent: z.boolean().optional().default(false),
});

/** GET: who would receive a reminder right now. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, reminder_sent_at")
    .eq("event_id", id)
    .eq("status", "paid");

  if (error) {
    if (error.message.includes("reminder_sent_at")) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = orders?.length ?? 0;
  const alreadySent = orders?.filter((o) => o.reminder_sent_at).length ?? 0;

  return NextResponse.json({ total, alreadySent, pending: total - alreadySent });
}

/**
 * POST: send the reminder.
 *
 * Only paid orders that don't have a reminder yet are mailed, unless the admin
 * asks for everyone. That makes the run resumable: Resend's free tier stops at
 * 100 mails a day, so a large event can hit the cap halfway — running it again
 * tomorrow then picks up exactly where it stopped instead of mailing the first
 * hundred people twice.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const { note, includeAlreadySent } = parsed.data;

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Evenement niet gevonden." }, { status: 404 });
  }

  let query = supabase.from("orders").select("*").eq("event_id", id).eq("status", "paid");
  if (!includeAlreadySent) {
    query = query.is("reminder_sent_at", null);
  }

  const { data: orders, error } = await query;

  if (error) {
    if (error.message.includes("reminder_sent_at")) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const failures: { email: string; reason: string }[] = [];

  // One at a time: the point is to stop cleanly when Resend starts refusing,
  // not to race a rate limit.
  for (const order of orders ?? []) {
    try {
      await sendReminderEmail(
        event as EventRow,
        order as OrderRow,
        note?.trim() || null,
        supabase
      );
      sent++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Onbekende fout";
      failures.push({ email: order.buyer_email, reason });
      // A refused key or a hit daily limit will refuse every remaining mail
      // too — stop instead of collecting the same error a hundred times.
      if (failures.length >= 3 && sent === 0) break;
    }
  }

  return NextResponse.json({
    sent,
    failed: failures.length,
    failures: failures.slice(0, 10),
    total: orders?.length ?? 0,
  });
}

const MIGRATION_HINT =
  "De database houdt de herinneringen nog niet bij. Run supabase/migrations/0013_mail_tracking.sql in de Supabase SQL Editor en probeer opnieuw.";
