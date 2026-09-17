import { notFound } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import { getSupabaseAdmin, type EventRow, type OrderRow } from "@/lib/supabase";
import { getBankAccountForEvent, getRemittanceTemplate, renderRemittanceTemplate } from "@/lib/sepaQr";
import BankTransferPayment from "./bank-transfer-payment";
import PaymentStatusWatcher from "./payment-status-watcher";

export const dynamic = "force-dynamic";

async function getOrderWithEvent(orderId: string) {
  const supabase = getSupabaseAdmin();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", order.event_id)
    .maybeSingle();

  if (!event) return null;

  return { order: order as OrderRow, event: event as EventRow };
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const result = await getOrderWithEvent(orderId);
  if (!result) notFound();

  const { order, event } = result;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="flex justify-center">
          <div className="inline-block rounded-lg bg-white px-3 py-1.5 shadow-sm">
            <Image
              src="/logo-wordmark.jpg"
              alt="vzw MC Attawassul"
              width={586}
              height={120}
              className="h-7 w-auto"
            />
          </div>
        </div>

        <h1 className="mt-8 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {event.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {order.buyer_name} · {order.quantity} ticket(s) · {order.price_tier_label}
        </p>

        {order.status === "paid" ? (
          <PaidConfirmation order={order} />
        ) : order.status === "open" ? (
          <>
            {order.payment_method === "bank_transfer" && (
              <BankTransferPaymentSection order={order} event={event} />
            )}
            {/* Polls in the background and refreshes this page the moment the
                payment is confirmed, so the buyer never has to reload. */}
            <PaymentStatusWatcher
              orderId={order.id}
              paymentMethod={order.payment_method}
            />
          </>
        ) : (
          <FailedPayment status={order.status} eventId={event.id} />
        )}
      </main>
    </div>
  );
}

async function PaidConfirmation({ order }: { order: OrderRow }) {
  const qrDataUrl = await QRCode.toDataURL(order.ticket_code, { width: 260 });
  const emailConfigured = !!(
    process.env.RESEND_API_KEY && process.env.TICKET_EMAIL_FROM
  );

  return (
    <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/60 dark:bg-emerald-950/30">
      <div className="flex flex-col items-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-xl text-white">
          ✓
        </span>
        <p className="mt-3 text-lg font-semibold text-emerald-900 dark:text-emerald-200">
          Betaling ontvangen
        </p>
        <p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-300/80">
          Je inschrijving is bevestigd. Bewaar deze QR-code — die wordt aan de
          ingang gescand.
        </p>
      </div>

      <div className="mt-6 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="QR-code ticket"
          width={220}
          height={220}
          className="rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-900/60"
        />
      </div>

      <p className="mt-3 text-xs text-emerald-800/70 dark:text-emerald-300/60">
        Ticketcode: {order.ticket_code}
      </p>
      {emailConfigured && (
        <p className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-300/60">
          We stuurden deze bevestiging ook naar {order.buyer_email}.
        </p>
      )}
    </div>
  );
}

function FailedPayment({
  status,
  eventId,
}: {
  status: OrderRow["status"];
  eventId: string;
}) {
  const text: Record<string, string> = {
    expired: "De betaling is verlopen — er is niets afgerekend.",
    canceled: "De betaling is geannuleerd — er is niets afgerekend.",
    failed: "De betaling is mislukt — er is niets afgerekend.",
  };

  return (
    <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/30">
      <p className="text-sm font-medium text-red-800 dark:text-red-300">
        {text[status] ?? "De betaling is niet doorgegaan."}
      </p>
      <a
        href={`/event/${eventId}`}
        className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Opnieuw proberen
      </a>
    </div>
  );
}

async function BankTransferPaymentSection({
  order,
  event,
}: {
  order: OrderRow;
  event: EventRow;
}) {
  const supabase = getSupabaseAdmin();
  const bankAccount = await getBankAccountForEvent(supabase, event);

  if (!bankAccount) {
    return (
      <p className="mt-6 text-sm text-red-500">
        Overschrijving is momenteel niet beschikbaar. Neem contact op met de
        organisator.
      </p>
    );
  }

  const template = await getRemittanceTemplate(supabase);
  const remittanceInfo = renderRemittanceTemplate(template, {
    nummer: order.order_number,
    evenement: event.title,
    naam: order.buyer_name,
  });
  const qrImageUrl = `${process.env.APP_URL}/api/tickets/${order.id}/payment-qr`;

  return (
    <BankTransferPayment
      qrImageUrl={qrImageUrl}
      iban={bankAccount.iban}
      beneficiaryName={bankAccount.account_holder}
      amountEuro={(order.amount_cents / 100).toFixed(2)}
      remittanceInfo={remittanceInfo}
    />
  );
}
