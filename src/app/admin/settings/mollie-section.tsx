"use client";

import { useState } from "react";
import type { PublicAppSettings } from "@/lib/supabase";
import ConfirmDeleteButton from "./confirm-delete-button";

/**
 * Mollie configuration. The API key itself is write-only: it is stored
 * server-side in app_settings and only ever comes back as a masked hint.
 */
export default function MollieSection({
  settings,
  onChange,
}: {
  settings: PublicAppSettings | null;
  onChange: (settings: PublicAppSettings) => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Kon de instelling niet opslaan.");
      return null;
    }
    onChange(data.settings);
    return data;
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCheckResult(null);

    const data = await patch({ mollie_api_key: keyInput.trim() });
    if (data) {
      setKeyInput("");
      const methods: string[] = data.mollieCheck?.methods ?? [];
      setCheckResult(
        methods.length > 0
          ? `Sleutel werkt. Actieve betaalmethodes bij Mollie: ${methods.join(", ")}.`
          : "Sleutel werkt, maar Mollie geeft nog geen actieve betaalmethodes terug. Activeer ze in je Mollie-dashboard."
      );
    }
    setSaving(false);
  }

  async function handleRemoveKey() {
    setCheckResult(null);
    await patch({ mollie_api_key: null });
  }

  async function handleToggleEnabled(enabled: boolean) {
    setTogglingEnabled(true);
    await patch({ mollie_enabled: enabled });
    setTogglingEnabled(false);
  }

  const hasKey = !!settings?.mollie_key_hint;
  const active = !!settings?.mollie_enabled && hasKey;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Online betalen (Mollie)
        </h2>
        {settings && (
          <span
            className={
              active
                ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }
          >
            {active ? "Actief" : "Uit"}
          </span>
        )}
        {settings?.mollie_mode === "live" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            LIVE — echte betalingen
          </span>
        )}
        {settings?.mollie_mode === "test" && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            TEST-modus
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Staat dit uit of is er geen sleutel, dan zien bezoekers enkel
        &quot;overschrijven met QR-code&quot;.
      </p>

      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {settings === null ? (
          <p className="text-sm text-zinc-500">Laden...</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={settings.mollie_enabled}
                disabled={togglingEnabled}
                onChange={(e) => handleToggleEnabled(e.target.checked)}
              />
              Online betalen aanbieden aan bezoekers
            </label>

            {hasKey ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-sm">
                  <span className="text-zinc-500">Sleutel: </span>
                  <code className="text-zinc-800 dark:text-zinc-200">
                    {settings.mollie_key_hint}
                  </code>
                  {settings.mollie_key_source === "env" && (
                    <span className="ml-2 text-xs text-zinc-500">
                      (uit de MOLLIE_API_KEY omgevingsvariabele — een sleutel die
                      je hier opslaat krijgt voorrang)
                    </span>
                  )}
                </div>
                {settings.mollie_key_source === "settings" && (
                  <ConfirmDeleteButton
                    triggerLabel="Sleutel verwijderen"
                    phrase="verwijder sleutel"
                    confirmLabel="Definitief verwijderen"
                    description="Dit wist de opgeslagen Mollie-sleutel. Bezoekers kunnen dan enkel nog overschrijven met QR-code."
                    onConfirm={handleRemoveKey}
                  />
                )}
              </div>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                Nog geen sleutel ingesteld — online betalen staat uit.
              </p>
            )}

            <form onSubmit={handleSaveKey} className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {hasKey
                    ? "Nieuwe API-sleutel (vervangt de huidige)"
                    : "Mollie API-sleutel"}
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="test_... of live_..."
                  className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Te vinden in je Mollie-dashboard onder Developers → API keys.
                Gebruik de test-sleutel om te proberen, de live-sleutel voor
                echte betalingen. We controleren de sleutel bij Mollie voor we
                ze opslaan.
              </p>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {checkResult && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {checkResult}
                </p>
              )}
              <button
                type="submit"
                disabled={saving || keyInput.trim().length === 0}
                className="h-11 self-start rounded-full bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {saving ? "Controleren bij Mollie..." : "Sleutel opslaan"}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
