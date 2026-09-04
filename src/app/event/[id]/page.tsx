import { notFound } from "next/navigation";
import { getSupabaseAdmin, type EventRow } from "@/lib/supabase";
import { formatEuroCents } from "@/lib/mollie";
import BuyForm from "./buy-form";

export const dynamic = "force-dynamic";

async function getEventWithAvailability(id: string) {
  const supabase = getSupabaseAdmin();

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (error) throw error;
  if (!event) return null;

  const { data: sale } = await supabase
    .from("event_sales")
    .select("tickets_paid")
    .eq("event_id", id)
    .maybeSingle();

  return { event: event as EventRow, ticketsSold: sale?.tickets_paid ?? 0 };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEventWithAvailability(id);

  if (!result) notFound();

  const { event, ticketsSold } = result;
  const remaining = Math.max(event.capacity - ticketsSold, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {event.title}
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {formatDate(event.event_date)} · {event.start_time.slice(0, 5)}–
          {event.end_time.slice(0, 5)}
        </p>
        {event.location && (
          <p className="mt-1 text-zinc-500">{event.location}</p>
        )}
        {event.description && (
          <p className="mt-4 whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {event.description}
          </p>
        )}

        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Prijs per ticket</span>
            <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {event.member_price_cents != null ? (
                <>
                  €{formatEuroCents(event.member_price_cents)}{" "}
                  <span className="text-sm font-normal text-zinc-500">(leden)</span>{" "}
                  / €{formatEuroCents(event.price_cents)}{" "}
                  <span className="text-sm font-normal text-zinc-500">
                    (niet-leden)
                  </span>
                </>
              ) : (
                <>€{formatEuroCents(event.price_cents)}</>
              )}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-zinc-500">Beschikbaar</span>
            <span className="text-zinc-500">{remaining} plaatsen</span>
          </div>

          {remaining > 0 ? (
            <BuyForm
              eventId={event.id}
              pricePerTicketCents={event.price_cents}
              memberPricePerTicketCents={event.member_price_cents}
              maxQuantity={Math.min(remaining, 10)}
              bankTransferAvailable={event.bank_account_id != null}
              mollieAvailable={!!process.env.MOLLIE_API_KEY}
            />
          ) : (
            <p className="mt-6 text-center font-medium text-red-500">
              Dit evenement is uitverkocht.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
