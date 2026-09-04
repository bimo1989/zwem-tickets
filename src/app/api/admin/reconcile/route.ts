import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { getSupabaseAdmin, type OrderRow } from "@/lib/supabase";
import { getRemittanceTemplate, renderRemittanceTemplate } from "@/lib/sepaQr";
import { matchOrdersToStatement, type BankStatementRow, type OrderForMatching } from "@/lib/reconcile";

type OpenOrderWithEvent = OrderRow & { events: { title: string } | null };

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString("nl-BE");
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
  }
  return String(value);
}

function cellToAmount(value: ExcelJS.CellValue): number | null {
  if (typeof value === "number") return value;
  if (value == null) return null;
  const parsed = parseFloat(cellToString(value).replace(/\./g, "").replace(",", "."));
  return isFinite(parsed) ? parsed : null;
}

function findColumnIndex(
  headers: string[],
  exact: string[],
  substrings: string[] = []
): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of exact) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return idx;
  }
  for (const c of substrings) {
    const idx = lower.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();

  try {
    if (file.name.toLowerCase().endsWith(".csv")) {
      await workbook.csv.read(Readable.from(buffer));
    } else {
      // Read from a stream rather than load(buffer) — exceljs's Buffer type
      // declaration predates @types/node's newer generic Buffer<T>, so the
      // two don't line up structurally even though it's the same object at
      // runtime.
      await workbook.xlsx.read(Readable.from(buffer));
    }
  } catch (err) {
    console.error("Failed to parse bank statement file:", err);
    return NextResponse.json(
      { error: "Kon het bestand niet lezen. Is het een geldig Excel- of CSV-bestand?" },
      { status: 400 }
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return NextResponse.json({ error: "Geen gegevens gevonden in het bestand." }, { status: 400 });
  }

  const headerRow = sheet.getRow(1).values as ExcelJS.CellValue[];
  // exceljs row.values is 1-indexed (index 0 is unused), so drop it to get
  // plain 0-indexed columns matching the rest of this function.
  const headers = headerRow.slice(1).map(cellToString);

  const amountIdx = findColumnIndex(headers, ["bedrag", "amount"], ["bedrag", "amount", "montant"]);
  const commIdx = findColumnIndex(
    headers,
    ["mededeling"],
    ["mededeling", "communication", "omschrijving", "description"]
  );
  const nameExactIdx = findColumnIndex(headers, ["naam tegenpartij", "tegenpartij naam"]);
  const nameIdx = nameExactIdx !== -1 ? nameExactIdx : findColumnIndex(headers, [], ["naam"]);
  const dateIdx = findColumnIndex(headers, ["boekdatum"], ["boekdatum", "datum", "date"]);

  if (amountIdx === -1 || commIdx === -1) {
    return NextResponse.json(
      {
        error: `Kon de kolommen "Bedrag" en/of "Mededeling" niet herkennen in dit bestand. Gevonden kolommen: ${headers.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const statementRows: BankStatementRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    const amount = cellToAmount(values[amountIdx]);
    if (amount == null || amount <= 0) return; // skip outgoing/invalid rows

    statementRows.push({
      amountCents: Math.round(amount * 100),
      communication: cellToString(values[commIdx]),
      counterpartyName: nameIdx !== -1 ? cellToString(values[nameIdx]) : "",
      date: dateIdx !== -1 ? cellToString(values[dateIdx]) : null,
    });
  });

  const supabase = getSupabaseAdmin();
  const { data: openOrdersData, error } = await supabase
    .from("orders")
    .select("*, events(title)")
    .eq("status", "open")
    .eq("payment_method", "bank_transfer");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const openOrders = (openOrdersData ?? []) as unknown as OpenOrderWithEvent[];
  const template = await getRemittanceTemplate(supabase);

  const ordersForMatching: OrderForMatching[] = openOrders.map((o) => ({
    id: o.id,
    amountCents: o.amount_cents,
    buyerName: o.buyer_name,
    remittance: renderRemittanceTemplate(template, {
      nummer: o.order_number,
      evenement: o.events?.title ?? "",
      naam: o.buyer_name,
    }),
  }));

  const { matches, unmatchedOrderIds } = matchOrdersToStatement(ordersForMatching, statementRows);
  const orderById = new Map(openOrders.map((o) => [o.id, o]));

  return NextResponse.json({
    matches: matches.map((m) => ({
      order: orderById.get(m.orderId),
      confidence: m.confidence,
      bankRow: m.bankRow,
    })),
    unmatchedOrders: unmatchedOrderIds.map((id) => orderById.get(id)),
    totalStatementRows: statementRows.length,
  });
}
