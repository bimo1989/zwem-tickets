"use client";

import { useState } from "react";

export default function BankTransferPayment({
  qrImageUrl,
  iban,
  beneficiaryName,
  amountEuro,
  remittanceInfo,
}: {
  qrImageUrl: string;
  iban: string;
  beneficiaryName: string;
  amountEuro: string;
  remittanceInfo: string;
}) {
  return (
    <div className="mt-6 text-left">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Optie 1: overschrijven met deze gegevens
        </p>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <CopyRow label="Rekeninghouder" value={beneficiaryName} />
          <CopyRow label="IBAN" value={iban} />
          <CopyRow label="Bedrag" value={`€${amountEuro}`} />
          <CopyRow label="Mededeling (belangrijk!)" value={remittanceInfo} />
        </div>
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Vermeld zeker de mededeling hierboven — daarmee herkennen we jouw
        betaling. Zodra we de storting zien, bevestigen we je ticket
        (dit kan even duren, het gaat niet automatisch).
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Optie 2: QR-code scannen
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Belangrijk: dit werkt <strong>niet</strong> met de gewone camera-app
          van je telefoon (die opent enkel platte tekst). Open in plaats
          daarvan je eigen bankapp (KBC, Belfius, ING, Argenta, ...) en zoek
          daar de functie <strong>&quot;Betalen via QR-code&quot;</strong> of
          <strong> &quot;Scan &amp; betaal&quot;</strong> — die herkent deze
          QR wél en vult alles automatisch in.
        </p>
        <div className="mt-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImageUrl}
            alt="Betaal-QR-code"
            width={180}
            height={180}
            className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800"
          />
        </div>
        <div className="mt-3">
          <CopyRow label="Link naar QR-afbeelding (bv. om door te sturen)" value={qrImageUrl} />
        </div>
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the value is still shown as text below.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {copied ? "Gekopieerd!" : "Kopieer"}
      </button>
    </div>
  );
}
