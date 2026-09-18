import { Resend } from "resend";
import QRCode from "qrcode";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin, type EventRow, type OrderRow } from "./supabase";

export type EmailConfig = {
  apiKey: string | null;
  fromAddress: string | null;
  /** Optional: where a buyer's reply should land, if not the from-address. */
  replyTo: string | null;
  /** Whether the admin wants confirmation mails sent at all. */
  enabled: boolean;
  source: "settings" | "env" | null;
};

/** Resend keys look like `re_` followed by a base58-ish string. */
export const RESEND_KEY_PATTERN = /^re_[A-Za-z0-9_-]{10,}$/;

/** `re_abcd…wxyz` — enough to recognise a key, not enough to use it. */
export function maskResendKey(apiKey: string): string {
  return `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`;
}

// Server-only. The key and sender address live in app_settings (managed from
// /admin/settings), with the environment variables as a fallback for installs
// that were set up before they moved into the database.
export async function getEmailConfig(client?: SupabaseClient): Promise<EmailConfig> {
  const supabase = client ?? getSupabaseAdmin();

  // An error here means the 0011 migration hasn't run yet — fall back to the
  // environment instead of silently dropping mails.
  const { data } = await supabase
    .from("app_settings")
    .select("resend_api_key, ticket_email_from, ticket_email_reply_to, email_enabled")
    .eq("id", true)
    .maybeSingle();

  const settingsKey = data?.resend_api_key?.trim() || null;
  const settingsFrom = data?.ticket_email_from?.trim() || null;
  const envKey = process.env.RESEND_API_KEY?.trim() || null;
  const envFrom = process.env.TICKET_EMAIL_FROM?.trim() || null;

  return {
    apiKey: settingsKey ?? envKey,
    fromAddress: settingsFrom ?? envFrom,
    replyTo: data?.ticket_email_reply_to?.trim() || null,
    enabled: data ? data.email_enabled : true,
    source: settingsKey ? "settings" : envKey ? "env" : null,
  };
}

/** True when a confirmation mail can actually be sent. */
export async function isEmailAvailable(client?: SupabaseClient): Promise<boolean> {
  const { apiKey, fromAddress, enabled } = await getEmailConfig(client);
  return enabled && !!apiKey && !!fromAddress;
}

export async function sendTicketEmail(
  event: EventRow,
  order: OrderRow,
  client?: SupabaseClient
) {
  const { apiKey, fromAddress, replyTo, enabled } = await getEmailConfig(client);

  if (!enabled) {
    console.warn("Confirmation mails are switched off — skipping.");
    return;
  }
  if (!apiKey || !fromAddress) {
    console.warn(
      "No Resend key or sender address configured — skipping confirmation email."
    );
    return;
  }

  const resend = new Resend(apiKey);
  const qrDataUrl = await QRCode.toDataURL(order.ticket_code, { width: 300 });
  const qrCid = "ticket-qr";
  const ticketUrl = process.env.APP_URL
    ? `${process.env.APP_URL}/ticket/${order.id}`
    : null;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Je ticket is bevestigd 🎟️</h2>
      <p>Beste ${escapeHtml(order.buyer_name)},</p>
      <p>Bedankt voor je betaling. Hieronder je ticket voor:</p>
      <p style="font-size: 18px; font-weight: bold;">${escapeHtml(event.title)}</p>
      <p>
        📅 ${event.event_date} &nbsp; 🕕 ${event.start_time.slice(0, 5)} - ${event.end_time.slice(0, 5)}<br/>
        📍 ${escapeHtml(event.location ?? "")}
      </p>
      <p>Aantal tickets: <strong>${order.quantity}</strong></p>
      <div style="text-align:center; margin: 24px 0;">
        <img src="cid:${qrCid}" alt="QR-code ticket" width="220" height="220" />
        <p style="font-size: 12px; color: #666;">Toon deze code aan de ingang</p>
      </div>
      ${
        ticketUrl
          ? `<p style="text-align:center;">
               <a href="${ticketUrl}" style="color:#059669;">Je ticket online bekijken</a>
               &nbsp;·&nbsp;
               <a href="${ticketUrl.replace(`/ticket/${order.id}`, `/api/tickets/${order.id}/pdf`)}" style="color:#059669;">Bewaren als PDF</a>
             </p>`
          : ""
      }
      <p style="font-size: 12px; color: #999;">Ticketcode: ${order.ticket_code}</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: order.buyer_email,
    ...(replyTo ? { replyTo } : {}),
    subject: `Ticket bevestigd: ${event.title}`,
    html,
    attachments: [
      {
        filename: "ticket-qr.png",
        content: qrDataUrl.split(",")[1],
        contentId: qrCid,
      },
    ],
  });

  // The SDK reports failures in the response rather than by throwing.
  if (error) {
    throw new Error(error.message ?? "Resend weigerde de mail.");
  }

  // Recorded so /admin can show who is still missing their confirmation —
  // Resend's free tier caps at 100 mails a day, which a busy day can hit.
  await (client ?? getSupabaseAdmin())
    .from("orders")
    .update({ ticket_email_sent_at: new Date().toISOString() })
    .eq("id", order.id);
}

/**
 * A short reminder a few days before the event, sent to everyone with a paid
 * ticket. `note` is an optional line the admin adds (what to bring, a change
 * of hall, ...).
 */
export async function sendReminderEmail(
  event: EventRow,
  order: OrderRow,
  note: string | null,
  client?: SupabaseClient
) {
  const { apiKey, fromAddress, replyTo, enabled } = await getEmailConfig(client);

  if (!enabled) throw new Error("Mails staan uit in de instellingen.");
  if (!apiKey || !fromAddress) {
    throw new Error("Geen Resend-sleutel of afzender ingesteld.");
  }

  const resend = new Resend(apiKey);
  const ticketUrl = process.env.APP_URL
    ? `${process.env.APP_URL}/ticket/${order.id}`
    : null;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Herinnering: ${escapeHtml(event.title)}</h2>
      <p>Beste ${escapeHtml(order.buyer_name)},</p>
      <p>Binnenkort is het zover. Dit zijn de gegevens:</p>
      <p>
        📅 ${event.event_date} &nbsp; 🕕 ${event.start_time.slice(0, 5)} - ${event.end_time.slice(0, 5)}<br/>
        📍 ${escapeHtml(event.location ?? "")}
      </p>
      <p>Jouw inschrijving: <strong>${order.quantity} ticket(s)</strong>.</p>
      ${
        note
          ? `<div style="border-left: 3px solid #059669; padding-left: 12px; margin: 20px 0;">
               ${escapeHtml(note).replace(/\n/g, "<br/>")}
             </div>`
          : ""
      }
      ${
        ticketUrl
          ? `<p style="text-align:center; margin: 24px 0;">
               <a href="${ticketUrl}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;">
                 Toon mijn ticket
               </a>
             </p>
             <p style="text-align:center; font-size: 12px;">
               <a href="${ticketUrl.replace(`/ticket/${order.id}`, `/api/tickets/${order.id}/pdf`)}" style="color:#059669;">Bewaren als PDF</a>
             </p>`
          : ""
      }
      <p style="font-size: 12px; color: #999;">Ticketcode: ${order.ticket_code}</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: order.buyer_email,
    ...(replyTo ? { replyTo } : {}),
    subject: `Herinnering: ${event.title}`,
    html,
  });

  if (error) {
    throw new Error(error.message ?? "Resend weigerde de mail.");
  }

  await (client ?? getSupabaseAdmin())
    .from("orders")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", order.id);
}

/**
 * Sends a short mail to an address the admin picks, so they can confirm the
 * key, the sender address and their domain verification all work before a
 * real buyer depends on it.
 */
export async function sendTestEmail(to: string, client?: SupabaseClient) {
  const { apiKey, fromAddress, replyTo } = await getEmailConfig(client);

  if (!apiKey) throw new Error("Geen Resend API-sleutel ingesteld.");
  if (!fromAddress) throw new Error("Geen afzender-adres ingesteld.");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject: "Testmail vanuit de ticketsite",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Dit werkt ✅</h2>
        <p>
          Deze testmail komt van de ticketsite van MC Attawassul. Krijg je hem,
          dan worden de bevestigingsmails naar kopers ook verstuurd.
        </p>
        <p style="font-size: 12px; color: #999;">
          Afzender: ${escapeHtml(fromAddress)}${
            replyTo ? ` &middot; antwoorden gaan naar ${escapeHtml(replyTo)}` : ""
          }
        </p>
      </div>
    `,
  });

  // The Resend SDK reports failures in the response rather than by throwing.
  if (error) {
    throw new Error(error.message ?? "Resend weigerde de mail.");
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
