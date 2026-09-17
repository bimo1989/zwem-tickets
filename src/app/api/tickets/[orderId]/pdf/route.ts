import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSupabaseAdmin, type EventRow, type OrderRow } from "@/lib/supabase";

/**
 * The ticket as a PDF, so a buyer can keep it, print it, or forward it — handy
 * when the confirmation mail never arrives or the phone has no signal at the
 * door.
 *
 * Public, like the ticket page itself: the order id is an unguessable UUID.
 * Only a paid order has a ticket to hand out.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Bestelling niet gevonden." }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Dit ticket is nog niet betaald." },
      { status: 409 }
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", order.event_id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Evenement niet gevonden." }, { status: 404 });
  }

  const pdf = await buildTicketPdf(order as OrderRow, event as EventRow);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${buildFilename(
        event as EventRow,
        order as OrderRow
      )}"`,
      // A ticket never changes once it's paid, but it must not end up in a
      // shared cache either — it's one person's admission.
      "Cache-Control": "private, no-store",
    },
  });
}

async function buildTicketPdf(order: OrderRow, event: EventRow): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Ticket ${event.title}`);
  doc.setCreator("vzw MC Attawassul");

  const page = doc.addPage([420, 595]); // A5 portrait
  const { width } = page.getSize();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.09, 0.11);
  const muted = rgb(0.45, 0.45, 0.5);
  const accent = rgb(0.02, 0.59, 0.41);

  // Header band
  page.drawRectangle({ x: 0, y: 545, width, height: 50, color: ink });
  page.drawText("vzw MC Attawassul", {
    x: 32,
    y: 566,
    size: 14,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = 500;

  page.drawText("TOEGANGSTICKET", { x: 32, y, size: 9, font: bold, color: accent });
  y -= 26;

  for (const line of wrapText(event.title, bold, 20, width - 64)) {
    page.drawText(line, { x: 32, y, size: 20, font: bold, color: ink });
    y -= 25;
  }

  y -= 6;
  const details: [string, string][] = [
    ["Datum", formatDate(event.event_date)],
    ["Uur", `${event.start_time.slice(0, 5)} - ${event.end_time.slice(0, 5)}`],
    ["Locatie", event.location ?? "-"],
    ["Naam", order.buyer_name],
    ["Aantal", `${order.quantity} ticket(s) - ${order.price_tier_label}`],
    ["Bestelnummer", String(order.order_number)],
  ];

  for (const [label, value] of details) {
    page.drawText(label, { x: 32, y, size: 9, font: regular, color: muted });
    for (const line of wrapText(value, regular, 11, width - 150)) {
      page.drawText(line, { x: 130, y, size: 11, font: bold, color: ink });
      y -= 14;
    }
    y -= 6;
  }

  // QR code
  const qrPng = await QRCode.toBuffer(order.ticket_code, {
    width: 600,
    margin: 1,
  });
  const qrImage = await doc.embedPng(qrPng);
  const qrSize = 170;
  const qrX = (width - qrSize) / 2;
  // Follows the details block instead of sitting at a fixed height, so a short
  // ticket has no gaping hole in the middle and a long one still fits above
  // the footer.
  const qrY = Math.max(70, y - 45 - qrSize);

  page.drawRectangle({
    x: qrX - 12,
    y: qrY - 12,
    width: qrSize + 24,
    height: qrSize + 24,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.85, 0.85, 0.87),
    borderWidth: 1,
  });
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const codeLabel = "Ticketcode: " + order.ticket_code;
  page.drawText(codeLabel, {
    x: (width - regular.widthOfTextAtSize(codeLabel, 9)) / 2,
    y: qrY - 26,
    size: 9,
    font: regular,
    color: muted,
  });

  const footer = "Toon deze QR-code aan de ingang. Elk ticket wordt eenmaal gescand.";
  page.drawText(footer, {
    x: (width - regular.widthOfTextAtSize(footer, 8)) / 2,
    y: 28,
    size: 8,
    font: regular,
    color: muted,
  });

  return doc.save();
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** pdf-lib has no text wrapping of its own. */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number
): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["-"];

  const lines: string[] = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

/**
 * The standard PDF fonts only cover WinAnsi, so anything outside it (emoji,
 * Arabic, curly quotes) would make pdf-lib throw while drawing.
 */
function sanitize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\xFF]/g, "")
    .trim();
}

function buildFilename(event: EventRow, order: OrderRow): string {
  const slug = sanitize(event.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `ticket-${slug || "evenement"}-${order.order_number}.pdf`;
}
