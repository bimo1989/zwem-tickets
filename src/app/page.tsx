import Link from "next/link";
import { getSupabaseAdmin, type EventRow } from "@/lib/supabase";
import { formatEuroCents } from "@/lib/mollie";

export const dynamic = "force-dynamic";

async function getUpcomingEventsWithAvailability() {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: events, error } = await supabase
    .from("events")
    .select("*, event_price_tiers(id)")
    .eq("is_published", true)
    .gte("event_date", today)
    .order("event_date", { ascending: true });

  if (error) throw error;

  const { data: sales } = await supabase
    .from("event_sales")
    .select("event_id, tickets_paid");

  const soldMap = new Map(
    (sales ?? []).map((s) => [s.event_id, s.tickets_paid as number])
  );

  return (events as (EventRow & { event_price_tiers: { id: string }[] })[]).map((event) => ({
    event,
    ticketsSold: soldMap.get(event.id) ?? 0,
    tierCount: event.event_price_tiers.length,
  }));
}

export default async function Home() {
  const upcoming = await getUpcomingEventsWithAvailability();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Aankomende evenementen
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Koop je ticket online en betaal direct.
        </p>

        <div className="mt-10 flex flex-col gap-5">
          {upcoming.length === 0 && (
            <p className="text-zinc-500">
              Er zijn momenteel geen evenementen open voor inschrijving.
            </p>
          )}

          {upcoming.map(({ event, ticketsSold, tierCount }) => {
            const remaining = event.capacity - ticketsSold;
            const soldOut = remaining <= 0;

            return (
              <Link
                key={event.id}
                href={soldOut ? "#" : `/event/${event.id}`}
                aria-disabled={soldOut}
                className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900 ${
                  soldOut
                    ? "pointer-events-none opacity-60"
                    : "hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                      {event.title}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {formatDate(event.event_date)} · {event.start_time.slice(0, 5)}–
                      {event.end_time.slice(0, 5)}
                    </p>
                    {event.location && (
                      <p className="mt-1 text-sm text-zinc-500">{event.location}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {tierCount > 1 ? "vanaf " : ""}€{formatEuroCents(event.price_cents)}
                    </p>
                    <p
                      className={`mt-1 text-xs font-medium ${
                        soldOut ? "text-red-500" : "text-emerald-600"
                      }`}
                    >
                      {soldOut ? "Uitverkocht" : `Nog ${remaining} plaatsen`}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
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
