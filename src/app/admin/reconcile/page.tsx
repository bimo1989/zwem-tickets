"use client";

import { useState } from "react";
import type { OrderRow } from "@/lib/supabase";
import type { BankStatementRow } from "@/lib/reconcile";

type OrderWithEvent = OrderRow & { events: { title: string } | null };

type MatchResult = {
  order: OrderWithEvent;
  confidence: "sterk" | "zwak";
  bankRow: BankStatementRow;
};

type ReconcileResponse = {
  matches: MatchResult[];
  unmatchedOrders: OrderWithEvent[];
  totalStatementRows: number;
};

export default function AdminReconcilePage() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconcileResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);
    setConfirmedCount(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/reconcile", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Kon het bestand niet verwerken.");
        setUploading(false);
        return;
      }

      setResult(data);
      setSelected(new Set(data.matches.filter((m: MatchResult) => m.confidence === "sterk").map((m: MatchResult) => m.order.id)));
    } catch {
      setError("Kon het bestand niet verwerken.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function toggleSelected(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  async function handleConfirmSelected() {
    if (selected.size === 0 || !result) return;
    setConfirming(true);

    let successCount = 0;
    for (const orderId of selected) {
      const res = await fetch(`/api/admin/orders/${orderId}/mark-paid`, { method: "POST" });
      if (res.ok) successCount++;
    }

    setConfirmedCount(successCount);
    setResult({
      ...result,
      matches: result.matches.filter((m) => !selected.has(m.order.id)),
    });
    setSelected(new Set());
    setConfirming(false);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Bankafschrift vergelijken
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Laad een Excel- of CSV-export van je bankrekening op. We vergelijken automatisch
        bedrag en naam/mededeling met openstaande overschrijvingen.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm text-zinc-700 dark:text-zinc-300"
        />
        {uploading && <p className="mt-2 text-sm text-zinc-500">Bezig met verwerken...</p>}
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="mt-8">
          <p className="text-sm text-zinc-500">
            {result.totalStatementRows} inkomende transacties gevonden in het bestand.
          </p>

          <h2 className="mt-6 text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Gevonden matches ({result.matches.length})
          </h2>
          {result.matches.length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">
              Geen matches gevonden voor openstaande overschrijvingen.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {result.matches.map((m) => (
              <label
                key={m.order.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(m.order.id)}
                    onChange={() => toggleSelected(m.order.id)}
                  />
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {m.order.buyer_name} · {m.order.events?.title ?? "Onbekend evenement"} · €
                      {(m.order.amount_cents / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Gevonden: &quot;{m.bankRow.communication}&quot;
                      {m.bankRow.counterpartyName && ` — ${m.bankRow.counterpartyName}`}
                      {m.bankRow.date && ` (${m.bankRow.date})`}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.confidence === "sterk"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                  }`}
                >
                  {m.confidence === "sterk" ? "Sterke match" : "Zwakke match"}
                </span>
              </label>
            ))}
          </div>

          {result.matches.length > 0 && (
            <button
              onClick={handleConfirmSelected}
              disabled={selected.size === 0 || confirming}
              className="mt-4 h-11 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {confirming
                ? "Bezig..."
                : `Markeer ${selected.size} geselecteerde bestelling(en) als betaald`}
            </button>
          )}

          {confirmedCount != null && (
            <p className="mt-2 text-sm text-emerald-600">
              {confirmedCount} bestelling(en) bevestigd als betaald.
            </p>
          )}

          {result.unmatchedOrders.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Nog niet gevonden ({result.unmatchedOrders.length})
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Deze openstaande overschrijvingen kwamen niet overeen met een rij in het
                bestand — mogelijk nog niet betaald, of de naam/het bedrag komt niet exact
                overeen.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {result.unmatchedOrders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    {o.buyer_name} · {o.events?.title ?? "Onbekend evenement"} · €
                    {(o.amount_cents / 100).toFixed(2)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
