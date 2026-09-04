import { Resend } from "resend";
import QRCode from "qrcode";
import type { EventRow, OrderRow } from "./supabase";

export async function sendTicketEmail(event: EventRow, order: OrderRow) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.TICKET_EMAIL_FROM;

  if (!apiKey || !fromAddress) {
    console.warn(
      "RESEND_API_KEY or TICKET_EMAIL_FROM not set — skipping confirmation email."
    );
    return;
  }

  const resend = new Resend(apiKey);
  const qrDataUrl = await QRCode.toDataURL(order.ticket_code, { width: 300 });
  const qrCid = "ticket-qr";

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
      <p style="font-size: 12px; color: #999;">Ticketcode: ${order.ticket_code}</p>
    </div>
  `;

  await resend.emails.send({
    from: fromAddress,
    to: order.buyer_email,
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
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
