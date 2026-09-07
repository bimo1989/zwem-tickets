"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventPriceTierRow, EventRow, WaitlistEntryRow } from "@/lib/supabase";

type EventWithTiers = EventRow & { event_price_tiers: EventPriceTierRow[] };

export default function AdminWaitlistPage() {
  const [events, setEvents] = useState<EventWithTiers[]>([]);
  const [entries, setEntries] = useState<WaitlistEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    Promise.all([
      fetch("/api/admin/events").then((res) => res.json()),
      fetch("/api/admin/waitlist").then((res) => res.json()),
    ]).then(([eventsData, waitlistData]) => {
      const evs: EventWithTiers[] = eventsData.events ?? [];
      setEvents(evs);
      setEntries(waitlistData.entries ?? []);
      setLoading(false);
      setSelectedEventId((current) => {
        if (current) return current;
        const withWaitlist = evs.find((e) => e.waitlist_enabled);
        return withWaitlist?.id ?? evs[0]?.id ?? "";
      });
    });
  }

  useEffect(() => {
    load();
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const visibleEntries = useMemo(
    () => entries.filter((e) => e.event_id === selectedEventId),
    [entries, selectedEventId]
  );

  function startPromote(entry: WaitlistEntryRow) {
    setPromotingId(entry.id);
    setError(null);
    const firstTier = selectedEvent?.event_price_tiers[0];
    setSelectedTierId(firstTier?.id ?? "");
  }

  function cancelPromote() {
    setPromotingId(null);
    setSelectedTierId("");
    setError(null);
  }

  async function confirmPromote(entry: WaitlistEntryRow) {
    if (!selectedTierId) {
      setError("Kies een prijscategorie.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/waitlist/${entry.id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceTierId: selectedTierId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Kon inschrijving niet omzetten.");
      return;
    }
    setPromotingId(null);
    setSelectedTierId("");
    load();
  }

  async function handleDelete(entry: WaitlistEntryRow) {
    setBusy(true);
    await fetch(`/api/admin/waitlist/${entry.id}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Wachtlijst</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Mensen die zich aanmeldden toen een evenement uitverkocht was. Zet een
        inschrijving om naar een bestelling zodra er een plaats vrijkomt.
      </p>

      {loading ? (
        <p className="mt-8 text-zinc-500">Laden...</p>
      ) : events.length === 0 ? (
        <p className="mt-8 text-zinc-500">Nog geen evenementen aangemaakt.</p>
      ) : (
        <>
          <div className="mt-6">
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                cancelPromote();
              }}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} · {ev.event_date}
                  {ev.waitlist_enabled ? "" : " (wachtlijst niet ingeschakeld)"}
                </option>
              ))}
            </select>
          </div>

          {selectedEvent && !selectedEvent.waitlist_enabled && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Wachtlijst is niet ingeschakeld voor dit evenement. Schakel deze in
              bij Evenementen om nieuwe aanmeldingen mogelijk te maken —
              bestaande aanmeldingen hieronder blijven wel beschikbaar.
            </p>
          )}

          <div className="mt-6 overflow-x-auto">
            {visibleEntries.length === 0 ? (
              <p className="text-zinc-500">Geen wachtlijst-aanmeldingen voor dit evenement.</p>
            ) : (
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                    <th className="py-2 pr-3 font-medium">Naam</th>
                    <th className="py-2 pr-3 font-medium">Contact</th>
                    <th className="py-2 pr-3 font-medium">Aantal</th>
                    <th className="py-2 pr-3 font-medium">Aangemeld</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-zinc-100 align-top dark:border-zinc-900"
                    >
                      <td className="py-3 pr-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {entry.buyer_name}
                      </td>
                      <td className="py-3 pr-3 text-zinc-500">
                        <div>{entry.buyer_email}</div>
                        {entry.buyer_phone && <div>{entry.buyer_phone}</div>}
                      </td>
                      <td className="py-3 pr-3 text-zinc-500">{entry.quantity}</td>
                      <td className="py-3 pr-3 text-zinc-500">
                        {new Date(entry.created_at).toLocaleString("nl-BE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3 pr-3">
                        {entry.promoted_order_id ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            Omgezet
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Wachtend
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {!entry.promoted_order_id && (
                          <div className="flex flex-col items-end gap-2">
                            {promotingId === entry.id ? (
                              <div className="flex flex-col items-end gap-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                                <select
                                  value={selectedTierId}
                                  onChange={(e) => setSelectedTierId(e.target.value)}
                                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                >
                                  {(selectedEvent?.event_price_tiers ?? [])
                                    .slice()
                                    .sort((a, b) => a.display_order - b.display_order)
                                    .map((tier) => (
                                      <option key={tier.id} value={tier.id}>
                                        {tier.label} · €{(tier.price_cents / 100).toFixed(2)}
                                      </option>
                                    ))}
                                </select>
                                <div className="flex gap-2">
                                  <button
                                    disabled={busy}
                                    onClick={() => confirmPromote(entry)}
                                    className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                                  >
                                    Bevestig
                                  </button>
                                  <button
                                    onClick={cancelPromote}
                                    className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                  >
                                    Annuleer
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startPromote(entry)}
                                  disabled={
                                    busy || !selectedEvent || selectedEvent.bank_account_id == null
                                  }
                                  title={
                                    selectedEvent && selectedEvent.bank_account_id == null
                                      ? "Stel eerst een rekening voor overschrijvingen in bij dit evenement."
                                      : undefined
                                  }
                                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                >
                                  Omzetten naar bestelling
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => handleDelete(entry)}
                                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                                >
                                  Verwijder
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </>
      )}
    </main>
  );
}
