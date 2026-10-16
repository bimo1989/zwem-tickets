"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventRow, OrderRow } from "@/lib/supabase";
// Type-only, so none of auth.ts's server imports reach the browser bundle.
import type { Role } from "@/lib/auth";
import {
  buildWhatsAppLink,
  buildWhatsAppShareLink,
  normalizePhoneForWhatsApp,
} from "@/lib/whatsapp";

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

export default function OrdersView() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  // Skipping is local to this sitting; marking someone done is shared, so a
  // second volunteer doesn't message them again.
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  // Comes back with the orders; decides which actions are shown. The server
  // refuses the rest regardless of what the page renders.
  const [role, setRole] = useState<Role | null>(null);
  const isAdmin = role === "admin";

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setOrders(data.orders ?? []);
        setRole(data.role ?? null);
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

  async function handleCancel(orderId: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
      method: "POST",
    });
    const data = await res.json();
    setConfirmingCancelId(null);

    if (!res.ok) {
      alert(data.error ?? "Kon de bestelling niet annuleren.");
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
  }

  async function handleResendTicket(orderId: string) {
    setResendingId(orderId);
    const res = await fetch(`/api/admin/orders/${orderId}/resend-ticket`, {
      method: "POST",
    });
    const data = await res.json();
    setResendingId(null);

    if (!res.ok) {
      alert(data.error ?? "Kon de mail niet versturen.");
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
  }

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
    const ticketUrl = `${window.location.origin}/ticket/${order.id}`;

    let message: string;
    if (order.status === "paid") {
      // Delivers the ticket itself — useful when the confirmation mail never
      // arrived, or didn't go out at all.
      message = `Hallo ${order.buyer_name}, je inschrijving voor "${event?.title ?? "het evenement"}" is bevestigd. Via deze link vind je je ticket met de QR-code die aan de ingang gescand wordt, en kan je het ook als PDF bewaren: ${ticketUrl} — tot dan!`;
    } else if (order.payment_method === "bank_transfer") {
      message = `Hallo ${order.buyer_name}, we zien nog geen betaling binnenkomen voor je ticket voor "${event?.title ?? "het evenement"}" (referentie ${shortCode}). Via deze link vind je de betaalgegevens (IBAN + QR-code) nog eens terug: ${ticketUrl} — kan je dit even in orde brengen? Bedankt!`;
    } else {
      message = `Hallo ${order.buyer_name}, we zien nog geen betaling binnenkomen voor je ticket voor "${event?.title ?? "het evenement"}" (referentie ${shortCode}). Kan je dit even nakijken? Bedankt!`;
    }

    return buildWhatsAppLink(order.buyer_phone, message);
  }

  function buildParticipantSummaryLink(eventId: string): string | null {
    const event = events.find((e) => e.id === eventId);
    if (!event) return null;

    const relevant = orders
      .filter((o) => o.event_id === eventId && (o.status === "paid" || o.status === "open"))
      .sort((a, b) => a.buyer_name.localeCompare(b.buyer_name, "nl"));

    if (relevant.length === 0) return null;

    const nameWidth = Math.min(
      Math.max(...relevant.map((o) => o.buyer_name.length), 4),
      20
    );
    const pad = (s: string, w: number) => (s.length > w ? s.slice(0, w - 1) + "…" : s.padEnd(w));

    const header = `${pad("Naam", nameWidth)} Aantal Betaald`;
    const lines = relevant.map((o) => {
      const naam = pad(o.buyer_name, nameWidth);
      const aantal = String(o.quantity).padEnd(6);
      const betaald = o.status === "paid" ? "Ja" : "Nee";
      return `${naam} ${aantal} ${betaald}`;
    });

    const totalPeople = relevant.reduce((sum, o) => sum + o.quantity, 0);
    const totalPaid = relevant
      .filter((o) => o.status === "paid")
      .reduce((sum, o) => sum + o.quantity, 0);

    const message = [
      `*${event.title}* (${event.event_date})`,
      "```",
      header,
      ...lines,
      "```",
      `Totaal: ${totalPeople} personen, ${totalPaid} betaald`,
    ].join("\n");

    return buildWhatsAppShareLink(message);
  }

  function exportCsv() {
    const rows = [
      ["Naam", "E-mail", "Telefoon", "Aantal", "Categorie", "Bedrag (EUR)", "Status", "Besteld op", "Ticketcode"],
      ...filteredOrders.map((o) => [
        o.buyer_name,
        o.buyer_email,
        o.buyer_phone ?? "",
        String(o.quantity),
        o.price_tier_label,
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

  // Who still needs a message, in the order the list shows them. Cancelled,
  // expired and failed orders are left out: there's nothing to say to them.
  const whatsAppCandidates = useMemo(
    () =>
      filteredOrders.filter(
        (o) =>
          !!o.buyer_phone &&
          (o.status === "paid" || o.status === "open") &&
          !!normalizePhoneForWhatsApp(o.buyer_phone)
      ),
    [filteredOrders]
  );
  const whatsAppDone = whatsAppCandidates.filter((o) => o.whatsapp_sent_at);
  const whatsAppQueue = whatsAppCandidates.filter((o) => !o.whatsapp_sent_at);
  const nextInQueue = whatsAppQueue.find((o) => !skippedIds.includes(o.id));

  async function markWhatsAppSent(orderId: string, reset = false) {
    const res = await fetch(`/api/admin/orders/${orderId}/whatsapp-sent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Kon dit niet bijhouden.");
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
  }

  /** Shared by the desktop table and the mobile cards. */
  function actionsFor(o: OrderRow) {
    const whatsAppLink = whatsAppLinkFor(o);

    return (
      <div className="flex flex-wrap gap-1.5">
        {isAdmin && o.status !== "paid" && (
          <button
            onClick={() => handleMarkPaid(o.id)}
            className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
          >
            Markeer betaald
          </button>
        )}
        {o.status === "open" &&
          (confirmingCancelId === o.id ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-2 py-1 text-xs dark:border-red-800">
              <span className="text-red-700 dark:text-red-400">Plaats vrijgeven?</span>
              <button
                onClick={() => handleCancel(o.id)}
                className="font-medium text-red-700 underline dark:text-red-400"
              >
                Ja, annuleer
              </button>
              <button
                onClick={() => setConfirmingCancelId(null)}
                className="text-zinc-500 underline"
              >
                Nee
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmingCancelId(o.id)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Annuleer
            </button>
          ))}
        {isAdmin && o.status === "paid" && (
          <button
            onClick={() => handleResendTicket(o.id)}
            disabled={resendingId === o.id}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {resendingId === o.id
              ? "Versturen..."
              : o.ticket_email_sent_at
                ? "Mail opnieuw sturen"
                : "Mail versturen"}
          </button>
        )}
        {whatsAppLink && (
          <a
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => markWhatsAppSent(o.id)}
            title={
              o.whatsapp_sent_at
                ? `Al gecontacteerd op ${new Date(o.whatsapp_sent_at).toLocaleString("nl-BE")}`
                : undefined
            }
            className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
          >
            {o.whatsapp_sent_at ? "✓ " : ""}
            {o.status === "paid" ? "Ticket via WhatsApp" : "WhatsApp sturen"}
          </a>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="p-10 text-zinc-500">Laden...</div>;
  }

  return (
    <div>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Ticketoverzicht
          </h1>
          {/* Stacks to full width on a phone instead of squeezing into a row. */}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
            {selectedEventId !== "all" &&
              (() => {
                const link = buildParticipantSummaryLink(selectedEventId);
                return link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
                  >
                    Deel deelnemerslijst via WhatsApp
                  </a>
                ) : null;
              })()}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <SummaryCard label="Betaalde tickets" value={String(summary.paidCount)} />
          <SummaryCard label="In afwachting" value={String(summary.pendingCount)} />
          <SummaryCard
            label="Omzet"
            value={`€${(summary.revenueCents / 100).toFixed(2)}`}
          />
        </div>

        {/* WhatsApp doesn't let a website send to many people at once — every
            message is one send from your own phone. What this removes is the
            bookkeeping: who's next, and who already had theirs. */}
        {whatsAppQueue.length > 0 && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                WhatsApp-ronde
              </p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70">
                {whatsAppDone.length} van {whatsAppDone.length + whatsAppQueue.length}{" "}
                gecontacteerd
              </p>
            </div>

            {nextInQueue ? (
              <>
                <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
                  Volgende: <strong>{nextInQueue.buyer_name}</strong> ·{" "}
                  {STATUS_LABELS[nextInQueue.status].toLowerCase()} ·{" "}
                  {nextInQueue.buyer_phone}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={whatsAppLinkFor(nextInQueue) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => markWhatsAppSent(nextInQueue.id)}
                    className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    Open WhatsApp voor {nextInQueue.buyer_name.split(" ")[0]}
                  </a>
                  <button
                    onClick={() => setSkippedIds((prev) => [...prev, nextInQueue.id])}
                    className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                  >
                    Overslaan
                  </button>
                </div>
                <p className="mt-2 text-xs text-emerald-800/70 dark:text-emerald-300/60">
                  WhatsApp opent met het bericht klaar — jij drukt zelf op
                  verzenden. Daarna kom je hier terug voor de volgende.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
                Iedereen is gecontacteerd of overgeslagen.
                {skippedIds.length > 0 && (
                  <button
                    onClick={() => setSkippedIds([])}
                    className="ml-2 underline"
                  >
                    Toon de {skippedIds.length} overgeslagen opnieuw
                  </button>
                )}
              </p>
            )}
          </div>
        )}

        <div className="mt-8 hidden overflow-x-auto rounded-xl border border-zinc-200 lg:block dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Naam</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Aantal</th>
                <th className="px-4 py-2">Categorie</th>
                <th className="px-4 py-2">Bedrag</th>
                <th className="px-4 py-2">Methode</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Ingecheckt</th>
                <th className="px-4 py-2">Mail</th>
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
                  <td className="px-4 py-2">{o.price_tier_label}</td>
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
                  <td className="px-4 py-2">
                    <MailStatus order={o} />
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {new Date(o.created_at).toLocaleString("nl-BE")}
                  </td>
                  <td className="px-4 py-2">{actionsFor(o)}</td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-zinc-500">
                    Geen bestellingen gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Below lg the same rows as cards: eleven columns don't fit on a
            phone, and sideways scrolling makes the actions unreachable. */}
        <div className="mt-6 flex flex-col gap-3 lg:hidden">
          {filteredOrders.length === 0 && (
            <p className="rounded-xl border border-zinc-200 px-4 py-6 text-center text-zinc-500 dark:border-zinc-800">
              Geen bestellingen gevonden.
            </p>
          )}
          {filteredOrders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {o.buyer_name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{o.buyer_email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                >
                  {STATUS_LABELS[o.status]}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <CardRow label="Aantal" value={`${o.quantity} · ${o.price_tier_label}`} />
                <CardRow label="Bedrag" value={`€${(o.amount_cents / 100).toFixed(2)}`} />
                <CardRow
                  label="Methode"
                  value={o.payment_method === "bank_transfer" ? "Overschrijving" : "Mollie"}
                />
                <CardRow
                  label="Ingecheckt"
                  value={o.status === "paid" ? `${o.checked_in_count} / ${o.quantity}` : "—"}
                />
                <div className="col-span-2 flex items-center gap-2">
                  <dt className="text-xs text-zinc-500">Mail</dt>
                  <dd>
                    <MailStatus order={o} />
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs text-zinc-400">
                Besteld op {new Date(o.created_at).toLocaleString("nl-BE")}
              </p>

              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                {actionsFor(o)}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-zinc-800 dark:text-zinc-200">{value}</dd>
    </div>
  );
}

/**
 * Whether the confirmation mail actually went out. Worth showing: Resend's
 * free tier stops at 100 mails a day, so a busy day can leave a few buyers
 * without one while their ticket is perfectly valid.
 */
function MailStatus({ order }: { order: OrderRow }) {
  if (order.status !== "paid") {
    return <span className="text-zinc-400">—</span>;
  }
  if (order.ticket_email_sent_at) {
    return (
      <span
        title={new Date(order.ticket_email_sent_at).toLocaleString("nl-BE")}
        className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
      >
        Verstuurd
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
      Niet verstuurd
    </span>
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
