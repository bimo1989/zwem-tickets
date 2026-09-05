import { notFound } from "next/navigation";
import { getSupabaseAdmin, type EventRow, type EventPriceTierRow } from "@/lib/supabase";
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

  const [{ data: sale }, { data: priceTiers }] = await Promise.all([
    supabase.from("event_sales").select("tickets_paid").eq("event_id", id).maybeSingle(),
    supabase
      .from("event_price_tiers")
      .select("*")
      .eq("event_id", id)
      .order("display_order", { ascending: true }),
  ]);

  return {
    event: event as EventRow,
    ticketsSold: sale?.tickets_paid ?? 0,
    priceTiers: (priceTiers ?? []) as EventPriceTierRow[],
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEventWithAvailability(id);

  if (!result) notFound();

  const { event, ticketsSold, priceTiers } = result;
  const remaining = Math.max(event.capacity - ticketsSold, 0);
  const deadlinePassed =
    !!event.registration_deadline && new Date(event.registration_deadline) < new Date();

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
          <div className="flex items-start justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">
              {priceTiers.length > 1 ? "Prijzen" : "Prijs per ticket"}
            </span>
            <span className="text-right text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {priceTiers.length > 1 ? (
                <span className="flex flex-col gap-0.5">
                  {priceTiers.map((tier) => (
                    <span key={tier.id}>
                      €{formatEuroCents(tier.price_cents)}{" "}
                      <span className="text-sm font-normal text-zinc-500">
                        ({tier.label})
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <>€{formatEuroCents(priceTiers[0]?.price_cents ?? event.price_cents)}</>
              )}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-zinc-500">Beschikbaar</span>
            <span className="text-zinc-500">{remaining} plaatsen</span>
          </div>
          {event.registration_deadline && !deadlinePassed && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-zinc-500">Inschrijven kan tot</span>
              <span className="text-zinc-500">
                {new Date(event.registration_deadline).toLocaleString("nl-BE", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
          )}

          {deadlinePassed ? (
            <p className="mt-6 text-center font-medium text-red-500">
              De inschrijving voor dit evenement is gesloten.
            </p>
          ) : remaining > 0 ? (
            <BuyForm
              eventId={event.id}
              priceTiers={priceTiers.map((t) => ({
                id: t.id,
                label: t.label,
                priceCents: t.price_cents,
              }))}
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
