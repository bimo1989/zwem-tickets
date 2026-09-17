"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderRow } from "@/lib/supabase";

type Status = OrderRow["status"];

// How often to ask, and for how long. Online payments settle in seconds, so
// poll quickly at first; a bank transfer is confirmed by hand by an admin, so
// check calmly in the background instead.
const FAST_INTERVAL_MS = 3_000;
const SLOW_INTERVAL_MS = 15_000;
const SPEED_UP_WINDOW_MS = 90_000;
const GIVE_UP_AFTER_MS = 15 * 60 * 1000;

/**
 * Watches an order that is still `open` and refreshes the page as soon as the
 * payment is confirmed, so the buyer gets a confirmation without reloading.
 * Renders the "waiting" message itself; the confirmed ticket is rendered by
 * the page after the refresh.
 */
export default function PaymentStatusWatcher({
  orderId,
  paymentMethod,
}: {
  orderId: string;
  paymentMethod: OrderRow["payment_method"];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("open");

  useEffect(() => {
    if (status !== "open") return;

    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    async function check() {
      if (stopped) return;

      try {
        const res = await fetch(`/api/tickets/${orderId}/status`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data: { status?: Status } = await res.json();
          if (data.status && data.status !== "open") {
            setStatus(data.status);
            // Re-render the server page so the QR code (or the failure
            // message) replaces this waiting state.
            router.refresh();
            return;
          }
        }
      } catch {
        // Offline or a hiccup — just try again on the next tick.
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed > GIVE_UP_AFTER_MS) return;

      const interval =
        paymentMethod === "mollie" && elapsed < SPEED_UP_WINDOW_MS
          ? FAST_INTERVAL_MS
          : SLOW_INTERVAL_MS;
      timer = setTimeout(check, interval);
    }

    timer = setTimeout(check, 1_500);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId, paymentMethod, status, router]);

  if (status !== "open") return null;

  if (paymentMethod === "bank_transfer") {
    return (
      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-400">
        <Spinner />
        Deze pagina springt automatisch op &quot;betaald&quot; zodra we je
        overschrijving verwerken — je hoeft niks te vernieuwen.
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="flex items-center justify-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
        <Spinner />
        We wachten op de bevestiging van je betaling...
      </p>
      <p className="mt-2 text-xs text-amber-700/80 dark:text-amber-400/70">
        Dit duurt normaal een paar seconden. Deze pagina werkt zichzelf bij —
        laat ze gewoon even openstaan.
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
