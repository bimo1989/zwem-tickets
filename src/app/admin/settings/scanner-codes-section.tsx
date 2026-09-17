"use client";

import { useEffect, useState } from "react";
import { formatScanCode, type ScannerCodeRow } from "@/lib/scanCode";

/**
 * Scan-only access for volunteers. Each code is shown in full, because the
 * admin has to be able to read it out and hand it over.
 */
export default function ScannerCodesSection() {
  const [codes, setCodes] = useState<ScannerCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/scanner-codes")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Kon de scan-codes niet laden.");
          return;
        }
        setCodes(data.scannerCodes ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);

    const res = await fetch("/api/admin/scanner-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Kon de code niet aanmaken.");
      setCreating(false);
      return;
    }

    setLabel("");
    setCreating(false);
    load();
  }

  async function handleDelete(code: ScannerCodeRow) {
    const ok = window.confirm(
      `Scan-code van ${code.label} intrekken? Die persoon kan dan niet meer scannen.`
    );
    if (!ok) return;

    const res = await fetch(`/api/admin/scanner-codes/${code.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Kon de code niet intrekken.");
      return;
    }
    load();
  }

  async function handleCopy(code: ScannerCodeRow) {
    try {
      await navigator.clipboard.writeText(formatScanCode(code.code));
      setCopied(code.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked — the code is on screen anyway.
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Scan-codes voor vrijwilligers
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Wie met zo&apos;n code inlogt, krijgt enkel de check-in scanner te zien —
        geen bestellingen, geen instellingen. Geef iedereen een eigen code, dan
        kun je één persoon intrekken zonder de rest te storen.
      </p>

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Voor wie is deze code?
          </label>
          <input
            required
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="bv. Youssef, of zaalploeg zaterdag"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={creating || label.trim().length === 0}
          className="h-11 rounded-full bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {creating ? "Bezig..." : "Code aanmaken"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {loading && <p className="text-zinc-500">Laden...</p>}
        {!loading && codes.length === 0 && !error && (
          <p className="text-zinc-500">Nog geen scan-codes aangemaakt.</p>
        )}
        {codes.map((code) => (
          <div
            key={code.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {code.label}
              </p>
              <p className="mt-0.5 font-mono text-lg tracking-widest text-zinc-900 dark:text-zinc-50">
                {formatScanCode(code.code)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {code.last_used_at
                  ? `Laatst gebruikt: ${new Date(code.last_used_at).toLocaleString("nl-BE")}`
                  : "Nog niet gebruikt"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(code)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {copied === code.id ? "Gekopieerd" : "Kopieer"}
              </button>
              <button
                onClick={() => handleDelete(code)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Intrekken
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        Zo leg je het uit aan een vrijwilliger: ga naar{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          /admin/login
        </code>
        , typ de code, en de camera start. Een sessie blijft 12 uur geldig.
      </p>
    </section>
  );
}
