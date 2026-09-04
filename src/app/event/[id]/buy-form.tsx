"use client";

import { useState } from "react";

type PaymentMethod = "mollie" | "bank_transfer";

export default function BuyForm({
  eventId,
  pricePerTicketCents,
  memberPricePerTicketCents,
  maxQuantity,
  bankTransferAvailable,
  mollieAvailable,
}: {
  eventId: string;
  pricePerTicketCents: number;
  memberPricePerTicketCents: number | null;
  maxQuantity: number;
  bankTransferAvailable: boolean;
  mollieAvailable: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isMember, setIsMember] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    mollieAvailable ? "mollie" : "bank_transfer"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMemberPrice = memberPricePerTicketCents != null;
  const unitPriceCents =
    isMember && memberPricePerTicketCents != null
      ? memberPricePerTicketCents
      : pricePerTicketCents;
  const total = ((unitPriceCents * quantity) / 100).toFixed(2);

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
          buyerName: name,
          buyerEmail: email,
          buyerPhone: phone,
          quantity,
          isMember,
          paymentMethod,
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

      {hasMemberPrice && (
        <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={isMember}
            onChange={(e) => setIsMember(e.target.checked)}
          />
          Ik ben lid (€{(memberPricePerTicketCents! / 100).toFixed(2)} i.p.v. €
          {(pricePerTicketCents / 100).toFixed(2)} per ticket)
        </label>
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

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
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
