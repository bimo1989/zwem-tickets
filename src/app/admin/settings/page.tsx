"use client";

import { useEffect, useState } from "react";
import type { BankAccountRow } from "@/lib/supabase";

type AccountForm = {
  label: string;
  account_holder: string;
  iban: string;
  bic: string;
  is_default: boolean;
};

const emptyAccountForm: AccountForm = {
  label: "",
  account_holder: "",
  iban: "",
  bic: "",
  is_default: false,
};

export default function AdminSettingsPage() {
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  const [template, setTemplate] = useState("");
  const [templateSaved, setTemplateSaved] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  function loadAccounts() {
    fetch("/api/admin/bank-accounts")
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data.bankAccounts ?? []);
        setLoadingAccounts(false);
      });
  }

  useEffect(() => {
    loadAccounts();
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setTemplate(data.settings?.remittance_template ?? ""));
  }, []);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setAccountError(null);

    const res = await fetch("/api/admin/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accountForm),
    });
    const data = await res.json();

    if (!res.ok) {
      setAccountError(data.error ?? "Kon rekening niet toevoegen.");
      setSavingAccount(false);
      return;
    }

    setAccountForm(emptyAccountForm);
    setShowAccountForm(false);
    setSavingAccount(false);
    loadAccounts();
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/admin/bank-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    loadAccounts();
  }

  async function handleDeleteAccount(id: string) {
    const res = await fetch(`/api/admin/bank-accounts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Kon rekening niet verwijderen.");
      return;
    }
    loadAccounts();
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSavingTemplate(true);
    setTemplateError(null);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remittance_template: template }),
    });
    const data = await res.json();

    if (!res.ok) {
      setTemplateError(data.error ?? "Kon sjabloon niet opslaan.");
      setSavingTemplate(false);
      return;
    }

    setTemplate(data.settings.remittance_template);
    setTemplateSaved(true);
    setSavingTemplate(false);
  }

  const previewText = template
    .replaceAll("{nummer}", "42")
    .replaceAll("{evenement}", "Zwemmen Vrouwen")
    .replaceAll("{naam}", "Jan Janssens");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Instellingen
      </h1>

      {/* Bank accounts */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Bankrekeningen
          </h2>
          <button
            onClick={() => setShowAccountForm((v) => !v)}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {showAccountForm ? "Annuleren" : "+ Nieuwe rekening"}
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Kies bij elk evenement (in &quot;Evenementen&quot;) naar welke rekening
          overschrijvingen moeten gebeuren.
        </p>

        {showAccountForm && (
          <form
            onSubmit={handleCreateAccount}
            className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Field label="Naam (voor jezelf, bv. &quot;Hoofdrekening vzw&quot;)">
              <input
                required
                value={accountForm.label}
                onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <Field label="Rekeninghouder (exacte naam op de rekening)">
              <input
                required
                value={accountForm.account_holder}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, account_holder: e.target.value })
                }
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="IBAN">
                <input
                  required
                  value={accountForm.iban}
                  onChange={(e) => setAccountForm({ ...accountForm, iban: e.target.value })}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="BE00 0000 0000 0000"
                />
              </Field>
              <Field label="BIC (optioneel)">
                <input
                  value={accountForm.bic}
                  onChange={(e) => setAccountForm({ ...accountForm, bic: e.target.value })}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={accountForm.is_default}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, is_default: e.target.checked })
                }
              />
              Instellen als standaardrekening
            </label>
            {accountError && <p className="text-sm text-red-500">{accountError}</p>}
            <button
              type="submit"
              disabled={savingAccount}
              className="h-11 rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {savingAccount ? "Bezig..." : "Rekening toevoegen"}
            </button>
          </form>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {loadingAccounts && <p className="text-zinc-500">Laden...</p>}
          {!loadingAccounts && accounts.length === 0 && (
            <p className="text-zinc-500">Nog geen rekeningen toegevoegd.</p>
          )}
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {acc.label}
                  {acc.is_default && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      Standaard
                    </span>
                  )}
                </p>
                <p className="text-sm text-zinc-500">
                  {acc.account_holder} · {acc.iban}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!acc.is_default && (
                  <button
                    onClick={() => handleSetDefault(acc.id)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Maak standaard
                  </button>
                )}
                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Verwijder
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Remittance template */}
      <section className="mt-12">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Sjabloon voor de mededeling
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Gebruik <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{"{nummer}"}</code>,{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{"{evenement}"}</code> en/of{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{"{naam}"}</code> — deze
          worden automatisch ingevuld per bestelling.
        </p>

        <form onSubmit={handleSaveTemplate} className="mt-4 flex flex-col gap-3">
          <input
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setTemplateSaved(false);
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="{nummer} - {evenement} - {naam}"
          />
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Voorbeeld: <span className="font-medium">{previewText}</span>
          </div>
          {templateError && <p className="text-sm text-red-500">{templateError}</p>}
          <button
            type="submit"
            disabled={savingTemplate || templateSaved}
            className="h-11 self-start rounded-full bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {savingTemplate ? "Bezig..." : templateSaved ? "Opgeslagen" : "Opslaan"}
          </button>
        </form>
      </section>
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
