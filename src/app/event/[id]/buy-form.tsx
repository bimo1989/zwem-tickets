"use client";

import { useState } from "react";

type PaymentMethod = "mollie" | "bank_transfer";
type PriceTier = { id: string; label: string; priceCents: number };
type Agreement = { id: string; text: string };

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

export default function BuyForm({
  eventId,
  priceTiers,
  maxQuantity,
  bankTransferAvailable,
  mollieAvailable,
  rulesText,
  rulesFileUrl,
  agreements,
}: {
  eventId: string;
  priceTiers: PriceTier[];
  maxQuantity: number;
  bankTransferAvailable: boolean;
  mollieAvailable: boolean;
  rulesText: string | null;
  rulesFileUrl: string | null;
  agreements: Agreement[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [priceTierId, setPriceTierId] = useState(priceTiers[0]?.id ?? "");
  // Bank transfer is preselected whenever it's available, also when online
  // payment is offered alongside it.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    bankTransferAvailable ? "bank_transfer" : "mollie"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedIds, setAgreedIds] = useState<string[]>([]);

  const allAgreed = agreements.every((a) => agreedIds.includes(a.id));
  const hasRules = !!rulesText || !!rulesFileUrl || agreements.length > 0;

  function toggleAgreement(id: string) {
    setAgreedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedTier = priceTiers.find((t) => t.id === priceTierId) ?? priceTiers[0];
  const total = (((selectedTier?.priceCents ?? 0) * quantity) / 100).toFixed(2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          priceTierId,
          buyerName: name,
          buyerEmail: email,
          buyerPhone: phone,
          quantity,
          paymentMethod,
          agreedIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Er ging iets mis. Probeer opnieuw.");
        setSubmitting(false);
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      setError("Er ging iets mis. Probeer opnieuw.");
      setSubmitting(false);
    }
  }

  if (!mollieAvailable && !bankTransferAvailable) {
    return (
      <p className="mt-6 text-center text-sm text-red-500">
        Er is momenteel geen betaalmethode beschikbaar. Neem contact op met de
        organisator.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Naam
        </label>
        <input
          required
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="Voor- en achternaam"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          E-mailadres
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="jij@voorbeeld.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          GSM-nummer
        </label>
        <input
          required
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="0470 12 34 56"
        />
        <p className="mt-1 text-xs text-zinc-400">
          Voor het geval we je moeten contacteren over je betaling.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Aantal tickets
        </label>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {Array.from({ length: maxQuantity }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {priceTiers.length > 1 && (
        <div>
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Prijscategorie
          </span>
          <div className="mt-1 flex flex-col gap-2">
            {priceTiers.map((tier) => (
              <label
                key={tier.id}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="priceTier"
                    checked={priceTierId === tier.id}
                    onChange={() => setPriceTierId(tier.id)}
                  />
                  {tier.label}
                </span>
                <span className="text-zinc-500">€{(tier.priceCents / 100).toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {mollieAvailable && bankTransferAvailable && (
        <div>
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Betaalmethode
          </span>
          <div className="mt-1 flex flex-col gap-2">
            <label className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "mollie"}
                onChange={() => setPaymentMethod("mollie")}
              />
              Online betalen (Bancontact, kaart, ...) — directe bevestiging
            </label>
            <label className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === "bank_transfer"}
                onChange={() => setPaymentMethod("bank_transfer")}
              />
              Overschrijving (QR-code) — bevestiging kan wat langer duren
            </label>
          </div>
        </div>
      )}

      {hasRules && (
        <div className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Reglement
          </p>

          {rulesText && (
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
              {rulesText}
            </p>
          )}

          {rulesFileUrl && (
            <div className="mt-3">
              {IMAGE_EXTENSIONS.test(rulesFileUrl) ? (
                <a href={rulesFileUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={rulesFileUrl}
                    alt="Reglement"
                    className="max-h-64 w-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
                  />
                </a>
              ) : (
                <a
                  href={rulesFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 underline dark:text-emerald-400"
                >
                  Lees het volledige reglement
                </a>
              )}
            </div>
          )}

          {agreements.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {agreements.map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <input
                    type="checkbox"
                    required
                    checked={agreedIds.includes(a.id)}
                    onChange={() => toggleAgreement(a.id)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>{a.text}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !allAgreed}
        className="mt-2 flex h-11 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {submitting ? "Bezig..." : `Betaal €${total}`}
      </button>
      <p className="text-center text-xs text-zinc-400">
        {paymentMethod === "mollie"
          ? "Je wordt doorgestuurd naar Mollie om veilig te betalen."
          : "Je krijgt een QR-code en de betaalgegevens om over te schrijven."}
      </p>
    </form>
  );
}
