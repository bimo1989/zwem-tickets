"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventRow, OrderRow } from "@/lib/supabase";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const STATUS_LABELS: Record<OrderRow["status"], string> = {
  paid: "Betaald",
  open: "In afwachting",
  expired: "Verlopen",
  canceled: "Geannuleerd",
  failed: "Mislukt",
};

const STATUS_COLORS: Record<OrderRow["status"], string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  expired: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  canceled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export default function AdminPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setOrders(data.orders ?? []);
        setLoading(false);

        const eventIdFromUrl = new URLSearchParams(window.location.search).get(
          "event"
        );
        if (eventIdFromUrl) setSelectedEventId(eventIdFromUrl);
      });
  }, []);

  const filteredOrders = useMemo(() => {
    if (selectedEventId === "all") return orders;
    return orders.filter((o) => o.event_id === selectedEventId);
  }, [orders, selectedEventId]);

  const summary = useMemo(() => {
    const paid = filteredOrders.filter((o) => o.status === "paid");
    const pending = filteredOrders.filter((o) => o.status === "open");
    return {
      paidCount: paid.reduce((sum, o) => sum + o.quantity, 0),
      pendingCount: pending.reduce((sum, o) => sum + o.quantity, 0),
      revenueCents: paid.reduce((sum, o) => sum + o.amount_cents, 0),
    };
  }, [filteredOrders]);

  async function handleMarkPaid(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/mark-paid`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Kon bestelling niet markeren als betaald.");
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
  }

  function whatsAppLinkFor(order: OrderRow): string | null {
    if (!order.buyer_phone) return null;
    const event = events.find((e) => e.id === order.event_id);
    const shortCode = order.ticket_code.slice(0, 8).toUpperCase();
    const message =
      order.status === "paid"
        ? `Hallo ${order.buyer_name}, dit is een bericht van ${event?.title ?? "ons"}.`
        : `Hallo ${order.buyer_name}, we zien nog geen betaling binnenkomen voor je ticket voor "${event?.title ?? "het evenement"}" (referentie ${shortCode}). Kan je dit even nakijken? Bedankt!`;
    return buildWhatsAppLink(order.buyer_phone, message);
  }

  function exportCsv() {
    const rows = [
      ["Naam", "E-mail", "Telefoon", "Aantal", "Lid", "Bedrag (EUR)", "Status", "Besteld op", "Ticketcode"],
      ...filteredOrders.map((o) => [
        o.buyer_name,
        o.buyer_email,
        o.buyer_phone ?? "",
        String(o.quantity),
        o.is_member ? "Ja" : "Nee",
        (o.amount_cents / 100).toFixed(2),
        STATUS_LABELS[o.status],
        new Date(o.created_at).toLocaleString("nl-BE"),
        o.ticket_code,
      ]),
    ];
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets-${selectedEventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="p-10 text-zinc-500">Laden...</div>;
  }

  return (
    <div>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Ticketoverzicht
          </h1>
          <div className="flex items-center gap-2">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="all">Alle evenementen</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({ev.event_date})
                </option>
              ))}
            </select>
            <button
              onClick={exportCsv}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Exporteer CSV
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <SummaryCard label="Betaalde tickets" value={String(summary.paidCount)} />
          <SummaryCard label="In afwachting" value={String(summary.pendingCount)} />
          <SummaryCard
            label="Omzet"
            value={`€${(summary.revenueCents / 100).toFixed(2)}`}
          />
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Naam</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Aantal</th>
                <th className="px-4 py-2">Lid</th>
                <th className="px-4 py-2">Bedrag</th>
                <th className="px-4 py-2">Methode</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Ingecheckt</th>
                <th className="px-4 py-2">Besteld op</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-2">{o.buyer_name}</td>
                  <td className="px-4 py-2">{o.buyer_email}</td>
                  <td className="px-4 py-2">{o.quantity}</td>
                  <td className="px-4 py-2">{o.is_member ? "Ja" : "Nee"}</td>
                  <td className="px-4 py-2">€{(o.amount_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {o.payment_method === "bank_transfer" ? "Overschrijving" : "Mollie"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {o.status === "paid" ? `${o.checked_in_count} / ${o.quantity}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {new Date(o.created_at).toLocaleString("nl-BE")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {o.status === "open" && (
                        <button
                          onClick={() => handleMarkPaid(o.id)}
                          className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                        >
                          Markeer betaald
                        </button>
                      )}
                      {o.status !== "paid" &&
                        (() => {
                          const link = whatsAppLinkFor(o);
                          return link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                            >
                              WhatsApp sturen
                            </a>
                          ) : null;
                        })()}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-zinc-500">
                    Geen bestellingen gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
