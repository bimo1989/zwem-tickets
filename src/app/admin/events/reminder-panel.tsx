"use client";

import { useState } from "react";

type Counts = { total: number; alreadySent: number; pending: number };
type SendResult = {
  sent: number;
  failed: number;
  total: number;
  failures: { email: string; reason: string }[];
};

/**
 * Sends a reminder to everyone with a paid ticket for one event. Only the
 * people who don't have a reminder yet are mailed, so running it again after
 * hitting Resend's daily cap continues where it stopped.
 */
export default function ReminderPanel({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [note, setNote] = useState("");
  const [includeAlreadySent, setIncludeAlreadySent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    setResult(null);
    setCounts(null);

    const res = await fetch(`/api/admin/events/${eventId}/reminders`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Kon de deelnemers niet ophalen.");
      return;
    }
    setCounts(data);
  }

  async function handleSend() {
    setSending(true);
    setError(null);

    const res = await fetch(`/api/admin/events/${eventId}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, includeAlreadySent }),
    });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "Versturen mislukt.");
      return;
    }
    setResult(data);

    // Refresh the counts so a follow-up run shows what's actually left.
    const refreshed = await fetch(`/api/admin/events/${eventId}/reminders`);
    if (refreshed.ok) setCounts(await refreshed.json());
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Herinnering sturen
      </button>
    );
  }

  const recipients = includeAlreadySent ? counts?.total : counts?.pending;

  return (
    <div className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Herinnering voor {eventTitle}
      </p>

      {counts === null && !error ? (
        <p className="mt-2 text-sm text-zinc-500">Deelnemers ophalen...</p>
      ) : counts ? (
        <p className="mt-1 text-sm text-zinc-500">
          {counts.total} deelnemer(s) met een betaald ticket
          {counts.alreadySent > 0 &&
            `, waarvan ${counts.alreadySent} al een herinnering kreeg`}
          .
        </p>
      ) : null}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={600}
        placeholder="Optioneel: iets dat ze moeten weten. Bv. 'Vergeet je zwemkledij en een handdoek niet.'"
        className="mt-3 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />

      {(counts?.alreadySent ?? 0) > 0 && (
        <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={includeAlreadySent}
            onChange={(e) => setIncludeAlreadySent(e.target.checked)}
          />
          Ook naar wie al een herinnering kreeg
        </label>
      )}

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {result && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-emerald-600 dark:text-emerald-400">
            {result.sent} verstuurd
            {result.failed > 0 && `, ${result.failed} mislukt`}.
          </p>
          {result.failures.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-500">
              {result.failures.map((f) => (
                <li key={f.email}>
                  {f.email}: {f.reason}
                </li>
              ))}
            </ul>
          )}
          {result.failed > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Loop je tegen de daglimiet van Resend aan? Probeer morgen opnieuw —
              wie al een mail kreeg, wordt dan overgeslagen.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleSend}
          disabled={sending || !counts || (recipients ?? 0) === 0}
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {sending
            ? "Versturen..."
            : `Verstuur naar ${recipients ?? 0} deelnemer(s)`}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sluiten
        </button>
      </div>
    </div>
  );
}
