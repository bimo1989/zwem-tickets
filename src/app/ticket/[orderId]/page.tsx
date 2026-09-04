import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getSupabaseAdmin, type EventRow, type OrderRow } from "@/lib/supabase";
import { getBankAccountForEvent, getRemittanceTemplate, renderRemittanceTemplate } from "@/lib/sepaQr";
import BankTransferPayment from "./bank-transfer-payment";

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
        <StatusBanner status={order.status} />

        <h1 className="mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {event.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {order.buyer_name} · {order.quantity} ticket(s) · {order.price_tier_label}
        </p>

        {order.status === "paid" ? (
          <>
            <div className="mt-8 flex justify-center">
              <img
                src={await QRCode.toDataURL(order.ticket_code, { width: 260 })}
                alt="QR-code ticket"
                width={220}
                height={220}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800"
              />
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              Ticketcode: {order.ticket_code}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Een bevestigingsmail is verstuurd naar {order.buyer_email}.
            </p>
          </>
        ) : order.status === "open" && order.payment_method === "bank_transfer" ? (
          <BankTransferPaymentSection order={order} event={event} />
        ) : (
          <p className="mt-6 text-sm text-zinc-500">
            Nog geen bevestiging van betaling ontvangen. Vernieuw deze pagina zo
            dadelijk, of check je e-mail.
          </p>
        )}
      </main>
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

function StatusBanner({ status }: { status: OrderRow["status"] }) {
  const map: Record<OrderRow["status"], { text: string; className: string }> = {
    paid: { text: "Betaling gelukt ✅", className: "text-emerald-600" },
    open: { text: "Betaling in verwerking...", className: "text-amber-500" },
    expired: { text: "Betaling verlopen", className: "text-red-500" },
    canceled: { text: "Betaling geannuleerd", className: "text-red-500" },
    failed: { text: "Betaling mislukt", className: "text-red-500" },
  };
  const { text, className } = map[status];
  return <p className={`text-lg font-medium ${className}`}>{text}</p>;
}
