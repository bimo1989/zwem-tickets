import Link from "next/link";
import { getSupabaseAdmin, type EventRow } from "@/lib/supabase";
import { formatEuroCents } from "@/lib/mollie";
import { getEventTheme, EventThemeIcon } from "@/lib/eventTheme";

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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-sky-800 to-cyan-700 px-8 py-12 text-white shadow-lg">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle, white 1.5px, transparent 1.5px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative">
            <p className="text-sm font-medium uppercase tracking-wide text-sky-200">
              MC Attawassul vzw
            </p>
            <h1 className="mt-2 text-3xl font-bold">Aankomende evenementen</h1>
            <p className="mt-2 text-sky-100">
              Koop je ticket online en betaal direct.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-5">
          {upcoming.length === 0 && (
            <p className="text-zinc-500">
              Er zijn momenteel geen evenementen open voor inschrijving.
            </p>
          )}

          {upcoming.map(({ event, ticketsSold, tierCount }) => {
            const remaining = event.capacity - ticketsSold;
            const soldOut = remaining <= 0;
            const deadlinePassed =
              !!event.registration_deadline && new Date(event.registration_deadline) < new Date();
            // A sold-out event with a waitlist is still clickable — visitors
            // need to reach the event page to sign up for it.
            const closed = deadlinePassed || (soldOut && !event.waitlist_enabled);
            const theme = getEventTheme(event.title);

            return (
              <Link
                key={event.id}
                href={closed ? "#" : `/event/${event.id}`}
                aria-disabled={closed}
                className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900 ${
                  closed
                    ? "pointer-events-none opacity-60"
                    : "hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                <div className={`relative h-16 overflow-hidden bg-gradient-to-br ${theme.gradient}`}>
                  <EventThemeIcon
                    icon={theme.icon}
                    className="absolute -right-3 -bottom-4 h-24 w-24 text-white/25"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 p-5">
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
                        closed
                          ? "text-red-500"
                          : soldOut
                            ? "text-amber-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {deadlinePassed
                        ? "Inschrijving gesloten"
                        : soldOut
                          ? event.waitlist_enabled
                            ? "Uitverkocht — wachtlijst"
                            : "Uitverkocht"
                          : `Nog ${remaining} plaatsen`}
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
