import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canFollowUpOrders, getRole } from "@/lib/auth";

const schema = z.object({
  /** Put someone back in the queue after a mis-click. */
  reset: z.boolean().optional().default(false),
});

/**
 * Marks that a WhatsApp chat was opened for this order, so a second volunteer
 * working the same list doesn't message the same person again. It records an
 * attempt, not a delivery: WhatsApp never tells a website whether the send
 * button was pressed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!canFollowUpOrders(await getRole())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("orders")
    .update({
      whatsapp_sent_at: parsed.data.reset ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.message.includes("whatsapp_sent_at")) {
      return NextResponse.json(
        {
          error:
            "De database houdt dit nog niet bij. Run supabase/migrations/0019_whatsapp_tracking.sql in de Supabase SQL Editor.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ order: data });
}
