"use client";

import { useState } from "react";
import type { PublicAppSettings } from "@/lib/supabase";

/**
 * Confirmation-mail configuration. Like the Mollie key, the Resend key is
 * write-only: it is stored server-side and only comes back masked.
 */
export default function EmailSection({
  settings,
  onChange,
}: {
  settings: PublicAppSettings | null;
  onChange: (settings: PublicAppSettings) => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [testTo, setTestTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    const body: Record<string, unknown> = {};
    if (keyInput.trim()) body.resend_api_key = keyInput.trim();
    if (fromInput.trim()) body.ticket_email_from = fromInput.trim();

    if (Object.keys(body).length === 0) {
      setSaving(false);
      return;
    }

    const data = await patch(body);
    if (data) {
      setKeyInput("");
      setFromInput("");
      setNotice("Opgeslagen. Stuur nu een testmail om te zien of het werkt.");
    }
    setSaving(false);
  }

  async function handleRemoveKey() {
    const ok = window.confirm(
      "De opgeslagen Resend-sleutel verwijderen? Er worden dan geen bevestigingsmails meer verstuurd."
    );
    if (!ok) return;
    setNotice(null);
    await patch({ resend_api_key: null });
  }

  async function handleToggle(enabled: boolean) {
    setToggling(true);
    setNotice(null);
    await patch({ email_enabled: enabled });
    setToggling(false);
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    setTesting(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/admin/settings/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testTo.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Kon de testmail niet versturen.");
    } else {
      setNotice(`Testmail verstuurd naar ${testTo.trim()}. Check ook je spam-map.`);
    }
    setTesting(false);
  }

  const hasKey = !!settings?.email_key_hint;
  const hasFrom = !!settings?.email_from;
  const active = !!settings?.email_enabled && hasKey && hasFrom;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Bevestigingsmails (Resend)
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
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Zodra een ticket betaald is, krijgt de koper automatisch een mail met
        zijn QR-code en een link om het ticket als PDF te bewaren. Staat dit
        uit, dan blijft het ticket wel gewoon op de website staan.
      </p>

      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {settings === null ? (
          <p className="text-sm text-zinc-500">Laden...</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={settings.email_enabled}
                disabled={toggling}
                onChange={(e) => handleToggle(e.target.checked)}
              />
              Bevestigingsmails versturen
            </label>

            {hasKey && hasFrom ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="text-sm">
                  <span className="text-zinc-500">Afzender: </span>
                  <code className="text-zinc-800 dark:text-zinc-200">
                    {settings.email_from}
                  </code>
                  <span className="text-zinc-500"> · sleutel: </span>
                  <code className="text-zinc-800 dark:text-zinc-200">
                    {settings.email_key_hint}
                  </code>
                  {settings.email_key_source === "env" && (
                    <span className="ml-2 text-xs text-zinc-500">
                      (uit de omgevingsvariabelen — wat je hier opslaat krijgt
                      voorrang)
                    </span>
                  )}
                </div>
                {settings.email_key_source === "settings" && (
                  <button
                    onClick={handleRemoveKey}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Sleutel verwijderen
                  </button>
                )}
              </div>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                {!hasKey && !hasFrom
                  ? "Nog geen sleutel en afzender ingesteld — er worden geen mails verstuurd."
                  : !hasKey
                    ? "Nog geen Resend-sleutel ingesteld — er worden geen mails verstuurd."
                    : "Nog geen afzender-adres ingesteld — er worden geen mails verstuurd."}
              </p>
            )}

            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {hasKey ? "Nieuwe Resend-sleutel (vervangt de huidige)" : "Resend API-sleutel"}
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="re_..."
                  className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Afzender
                </label>
                <input
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  placeholder={
                    settings.email_from ?? "MC Attawassul <tickets@jouwdomein.be>"
                  }
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <p className="text-xs text-zinc-500">
                  Het domein hierin moet in Resend geverifieerd zijn, anders
                  weigert Resend de mail. Nog geen eigen domein? Gebruik
                  voorlopig{" "}
                  <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
                    onboarding@resend.dev
                  </code>{" "}
                  — dat kan alleen naar je eigen account-adres mailen, dus enkel
                  om te testen.
                </p>
              </div>
              <button
                type="submit"
                disabled={saving || (!keyInput.trim() && !fromInput.trim())}
                className="h-11 self-start rounded-full bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {saving ? "Bezig..." : "Opslaan"}
              </button>
            </form>

            <form
              onSubmit={handleTest}
              className="flex flex-wrap items-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
            >
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Testmail sturen naar
                </label>
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="jij@voorbeeld.be"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={testing || !hasKey || testTo.trim().length === 0}
                className="h-11 rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
              >
                {testing ? "Versturen..." : "Testmail sturen"}
              </button>
            </form>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {notice && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
