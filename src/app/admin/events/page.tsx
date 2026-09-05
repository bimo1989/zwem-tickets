"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BankAccountRow, EventPriceTierRow, EventRow } from "@/lib/supabase";

type EventWithTiers = EventRow & { event_price_tiers: EventPriceTierRow[] };

type TierForm = { label: string; price_euro: string };

type FormState = {
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  priceTiers: TierForm[];
  capacity: string;
  registration_deadline: string;
  bank_account_id: string;
  is_published: boolean;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  event_date: "",
  start_time: "18:00",
  end_time: "20:00",
  location: "",
  priceTiers: [{ label: "Standaard", price_euro: "" }],
  capacity: "20",
  registration_deadline: "",
  bank_account_id: "",
  is_published: true,
};

// Formats an ISO timestamp as a value the <input type="datetime-local">
// element accepts (local time, no seconds/timezone).
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DELETE_CONFIRM_PHRASE = "verwijder evenement";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventWithTiers[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function loadEvents() {
    fetch("/api/admin/events")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadEvents();
    fetch("/api/admin/bank-accounts")
      .then((res) => res.json())
      .then((data) => {
        const accounts: BankAccountRow[] = data.bankAccounts ?? [];
        setBankAccounts(accounts);
        const defaultAccount = accounts.find((a) => a.is_default);
        if (defaultAccount) {
          setForm((f) => ({ ...f, bank_account_id: defaultAccount.id }));
        }
      });
  }, []);

  function updateTier(index: number, patch: Partial<TierForm>) {
    setForm((f) => ({
      ...f,
      priceTiers: f.priceTiers.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  }

  function addTier() {
    setForm((f) => ({ ...f, priceTiers: [...f.priceTiers, { label: "", price_euro: "" }] }));
  }

  function removeTier(index: number) {
    setForm((f) => ({ ...f, priceTiers: f.priceTiers.filter((_, i) => i !== index) }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const price_tiers = form.priceTiers
      .filter((t) => t.label.trim() && t.price_euro.trim())
      .map((t) => ({
        label: t.label.trim(),
        price_cents: Math.round(parseFloat(t.price_euro) * 100),
      }));

    if (price_tiers.length === 0) {
      setError("Voeg minstens 1 prijscategorie met naam en prijs toe.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location,
        price_tiers,
        capacity: parseInt(form.capacity, 10),
        registration_deadline: form.registration_deadline
          ? new Date(form.registration_deadline).toISOString()
          : null,
        bank_account_id: form.bank_account_id || null,
        is_published: form.is_published,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Kon evenement niet aanmaken.");
      setSubmitting(false);
      return;
    }

    setForm(emptyForm);
    setShowForm(false);
    setSubmitting(false);
    loadEvents();
  }

  async function handleChangeBankAccount(ev: EventRow, bankAccountId: string) {
    await fetch(`/api/admin/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bank_account_id: bankAccountId || null }),
    });
    loadEvents();
  }

  async function handleChangeDeadline(ev: EventRow, localValue: string) {
    await fetch(`/api/admin/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_deadline: localValue ? new Date(localValue).toISOString() : null,
      }),
    });
    loadEvents();
  }

  async function togglePublished(ev: EventRow) {
    await fetch(`/api/admin/events/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: !ev.is_published }),
    });
    loadEvents();
  }

  function startDelete(ev: EventRow) {
    setDeletingId(ev.id);
    setDeleteConfirmText("");
    setDeleteError(null);
  }

  function cancelDelete() {
    setDeletingId(null);
    setDeleteConfirmText("");
    setDeleteError(null);
  }

  async function confirmDelete(ev: EventRow) {
    if (deleteConfirmText.trim().toLowerCase() !== DELETE_CONFIRM_PHRASE) return;

    const res = await fetch(`/api/admin/events/${ev.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setDeleteError(data.error ?? "Kon evenement niet verwijderen.");
      return;
    }
    setDeletingId(null);
    setDeleteConfirmText("");
    loadEvents();
  }

  function handleDuplicate(ev: EventWithTiers) {
    const sortedTiers = [...ev.event_price_tiers].sort(
      (a, b) => a.display_order - b.display_order
    );
    setForm({
      title: `${ev.title} (kopie)`,
      description: ev.description ?? "",
      event_date: "",
      start_time: ev.start_time.slice(0, 5),
      end_time: ev.end_time.slice(0, 5),
      location: ev.location ?? "",
      priceTiers: sortedTiers.length
        ? sortedTiers.map((t) => ({ label: t.label, price_euro: (t.price_cents / 100).toFixed(2) }))
        : [{ label: "Standaard", price_euro: "" }],
      capacity: String(ev.capacity),
      registration_deadline: "",
      bank_account_id: ev.bank_account_id ?? "",
      is_published: false,
    });
    setShowForm(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Evenementen
        </h1>
        <button
          onClick={() => {
            if (!showForm) {
              const defaultAccount = bankAccounts.find((a) => a.is_default);
              setForm({ ...emptyForm, bank_account_id: defaultAccount?.id ?? "" });
            }
            setShowForm((v) => !v);
          }}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {showForm ? "Annuleren" : "+ Nieuw evenement"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-6 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <Field label="Titel">
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Privé zwemmen voor mannen"
            />
          </Field>

          <Field label="Beschrijving (optioneel)">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              rows={3}
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Datum">
              <input
                required
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <Field label="Van">
              <input
                required
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <Field label="Tot">
              <input
                required
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
          </div>

          <Field label="Locatie">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Weldoenerslaan 5, B-3630 Maasmechelen"
            />
          </Field>

          <div>
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Prijscategorieën
            </span>
            <p className="mt-1 text-xs text-zinc-400">
              Voeg zoveel categorieën toe als je nodig hebt (bv. Leden, Niet-leden,
              Studenten, ...). De koper kiest er bij het bestellen één.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {form.priceTiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={tier.label}
                    onChange={(e) => updateTier(index, { label: e.target.value })}
                    placeholder="Naam (bv. Leden)"
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.price_euro}
                    onChange={(e) => updateTier(index, { price_euro: e.target.value })}
                    placeholder="€"
                    className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    disabled={form.priceTiers.length <= 1}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTier}
              className="mt-2 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              + Categorie toevoegen
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Capaciteit (aantal tickets)">
              <input
                required
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <Field label="Inschrijving sluit op (optioneel)">
              <input
                type="datetime-local"
                value={form.registration_deadline}
                onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-zinc-400">
            Laat leeg om inschrijvingen open te houden tot het evenement start of
            uitverkocht is.
          </p>

          <Field label="Rekening voor overschrijvingen">
            <select
              value={form.bank_account_id}
              onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">Geen (enkel Mollie)</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label}
                </option>
              ))}
            </select>
            {bankAccounts.length === 0 && (
              <p className="mt-1 text-xs text-zinc-400">
                Nog geen rekeningen — voeg er een toe onder{" "}
                <Link href="/admin/settings" className="underline">
                  Instellingen
                </Link>
                .
              </p>
            )}
          </Field>

          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            Meteen publiceren (zichtbaar op de site)
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting ? "Bezig..." : "Evenement aanmaken"}
          </button>
        </form>
      )}

      <div className="mt-8 flex flex-col gap-3">
        {loading && <p className="text-zinc-500">Laden...</p>}
        {!loading && events.length === 0 && (
          <p className="text-zinc-500">Nog geen evenementen aangemaakt.</p>
        )}
        {events.map((ev) => (
          <div
            key={ev.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{ev.title}</p>
                <p className="text-sm text-zinc-500">
                  {ev.event_date} · {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)} ·{" "}
                  {[...ev.event_price_tiers]
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((t) => `${t.label} €${(t.price_cents / 100).toFixed(2)}`)
                    .join(" · ")}{" "}
                  · capaciteit {ev.capacity}
                  {ev.registration_deadline && (
                    <>
                      {" "}
                      · inschrijving sluit{" "}
                      {new Date(ev.registration_deadline).toLocaleString("nl-BE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={
                    ev.registration_deadline ? toDatetimeLocalValue(ev.registration_deadline) : ""
                  }
                  onChange={(e) => handleChangeDeadline(ev, e.target.value)}
                  title="Inschrijving sluit op"
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <select
                  value={ev.bank_account_id ?? ""}
                  onChange={(e) => handleChangeBankAccount(ev, e.target.value)}
                  title="Rekening voor overschrijvingen"
                  className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <option value="">Geen rekening</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.label}
                    </option>
                  ))}
                </select>
                <Link
                  href={`/admin?event=${ev.id}`}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Tickets
                </Link>
                <button
                  onClick={() => handleDuplicate(ev)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Dupliceer
                </button>
                <button
                  onClick={() => togglePublished(ev)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    ev.is_published
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {ev.is_published ? "Gepubliceerd" : "Verborgen"}
                </button>
                <button
                  onClick={() => startDelete(ev)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Verwijder
                </button>
              </div>
            </div>

            {deletingId === ev.id && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                <p className="text-sm text-red-700 dark:text-red-400">
                  Dit verwijdert <strong>{ev.title}</strong> permanent, inclusief alle
                  bestellingen en verkoopgeschiedenis. Typ{" "}
                  <code className="rounded bg-red-100 px-1 dark:bg-red-900">
                    {DELETE_CONFIRM_PHRASE}
                  </code>{" "}
                  om te bevestigen.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    autoFocus
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={DELETE_CONFIRM_PHRASE}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-sm dark:border-red-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => confirmDelete(ev)}
                    disabled={
                      deleteConfirmText.trim().toLowerCase() !== DELETE_CONFIRM_PHRASE
                    }
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Definitief verwijderen
                  </button>
                  <button
                    onClick={cancelDelete}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Annuleer
                  </button>
                </div>
                {deleteError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}
