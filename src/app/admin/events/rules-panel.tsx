"use client";

import { useState } from "react";
import type { EventAgreementRow, EventRow } from "@/lib/supabase";

/**
 * Manages one event's rules: a free-text block, an optional PDF/photo, and the
 * checkboxes a buyer has to tick before ordering.
 */
export default function RulesPanel({
  event,
  onEventChange,
}: {
  event: EventRow;
  onEventChange: (event: EventRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [agreements, setAgreements] = useState<EventAgreementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rulesText, setRulesText] = useState(event.rules_text ?? "");
  const [textSaved, setTextSaved] = useState(true);
  const [infoText, setInfoText] = useState(event.info_text ?? "");
  const [infoSaved, setInfoSaved] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/admin/events/${event.id}/agreements`);
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Kon het reglement niet laden.");
      return;
    }
    setAgreements(data.agreements ?? []);
  }

  async function patchEvent(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Opslaan mislukt.");
      return null;
    }
    onEventChange(data.event);
    return data.event as EventRow;
  }

  async function handleSaveText() {
    setBusy(true);
    const saved = await patchEvent({ rules_text: rulesText.trim() || null });
    if (saved) setTextSaved(true);
    setBusy(false);
  }

  async function handleSaveInfoText() {
    setBusy(true);
    const saved = await patchEvent({ info_text: infoText.trim() || null });
    if (saved) setInfoSaved(true);
    setBusy(false);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/events/${event.id}/agreements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newItem.trim() }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Kon het vinkje niet toevoegen.");
      return;
    }
    setAgreements((prev) => [...prev, data.agreement]);
    setNewItem("");
  }

  async function handleDeleteItem(id: string) {
    const res = await fetch(`/api/admin/events/${event.id}/agreements/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Verwijderen mislukt.");
      return;
    }
    setAgreements((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "rules" | "info"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);

    const res = await fetch(`/api/admin/events/${event.id}/rules-file`, {
      method: "POST",
      body,
    });
    const data = await res.json();
    setUploading(false);
    e.target.value = "";

    if (!res.ok) {
      setError(data.error ?? "Uploaden mislukt.");
      return;
    }
    onEventChange(data.event);
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Reglement &amp; info
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Reglement voor {event.title}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Deelnemers zien dit onderaan het inschrijfformulier en moeten elk vinkje
        aanzetten voor ze kunnen bestellen. Wat iemand aanvinkte, wordt bij de
        bestelling bewaard — ook als je de tekst later aanpast.
      </p>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {/* Free text */}
      <div className="mt-4">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Inleidende tekst (optioneel)
        </label>
        <textarea
          value={rulesText}
          onChange={(e) => {
            setRulesText(e.target.value);
            setTextSaved(false);
          }}
          rows={3}
          maxLength={5000}
          placeholder="Bv. een korte toelichting bij het reglement."
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          onClick={handleSaveText}
          disabled={busy || textSaved}
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          {textSaved ? "Opgeslagen" : "Tekst opslaan"}
        </button>
      </div>

      {/* Document or photo */}
      <div className="mt-4">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Reglement als document of foto (optioneel)
        </label>
        {event.rules_file_url ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <a
              href={event.rules_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              Huidig bestand bekijken
            </a>
            <button
              onClick={() => patchEvent({ rules_file_url: null })}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Verwijderen
            </button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">Nog geen bestand geüpload.</p>
        )}
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => handleUpload(e, "rules")}
          disabled={uploading}
          className="mt-2 block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium dark:text-zinc-400 dark:file:border-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
        {uploading && <p className="mt-1 text-xs text-zinc-500">Uploaden...</p>}
        <p className="mt-1 text-xs text-zinc-500">PDF, JPG, PNG of WEBP, max 8 MB.</p>
      </div>

      {/* Practical info — shown after booking, on the ticket page */}
      <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Praktische info (op het ticket)
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Dit verschijnt onder de QR-code op het ticket en in de bevestigingsmail,
          zodat deelnemers het de avond voordien kunnen herlezen. Denk aan
          openingsuur, wat ze moeten meebrengen, afspraken na het zwemmen.
        </p>

        <textarea
          value={infoText}
          onChange={(e) => {
            setInfoText(e.target.value);
            setInfoSaved(false);
          }}
          rows={3}
          maxLength={5000}
          placeholder="Optioneel: korte praktische tekst."
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          onClick={handleSaveInfoText}
          disabled={busy || infoSaved}
          className="mt-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          {infoSaved ? "Opgeslagen" : "Tekst opslaan"}
        </button>

        {event.info_file_url ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <a
              href={event.info_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              Huidig bestand bekijken
            </a>
            <button
              onClick={() => patchEvent({ info_file_url: null })}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Verwijderen
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Nog geen bestand geüpload.</p>
        )}
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => handleUpload(e, "info")}
          disabled={uploading}
          className="mt-2 block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium dark:text-zinc-400 dark:file:border-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
      </div>

      {/* Checkboxes */}
      <div className="mt-5">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Vinkjes die aangezet moeten worden
        </p>

        {loading && <p className="mt-2 text-sm text-zinc-500">Laden...</p>}
        {!loading && agreements.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">
            Nog geen vinkjes. Zonder vinkjes kan iemand gewoon bestellen.
          </p>
        )}

        <ul className="mt-2 flex flex-col gap-2">
          {agreements.map((a, index) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="text-zinc-700 dark:text-zinc-300">
                <span className="mr-1.5 text-zinc-400">{index + 1}.</span>
                {a.text}
              </span>
              <button
                onClick={() => handleDeleteItem(a.id)}
                className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Verwijder
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAddItem} className="mt-3 flex flex-wrap items-end gap-2">
          <textarea
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            rows={2}
            maxLength={600}
            placeholder="Bv. GSM's of andere foto/video-apparatuur komen niet in het zwembadgedeelte."
            className="min-w-60 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={busy || newItem.trim().length === 0}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Toevoegen
          </button>
        </form>
      </div>

      <button
        onClick={() => setOpen(false)}
        className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Sluiten
      </button>
    </div>
  );
}
