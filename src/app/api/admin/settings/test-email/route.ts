import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendTestEmail } from "@/lib/email";
import { getRole } from "@/lib/auth";

const schema = z.object({
  to: z.string().trim().email("Vul een geldig e-mailadres in."),
});

/**
 * Sends one test mail to an address the admin types in, so the key, the sender
 * address and the domain verification are all proven to work before a real
 * buyer depends on them.
 */
export async function POST(req: NextRequest) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ongeldige aanvraag." },
      { status: 400 }
    );
  }

  try {
    await sendTestEmail(parsed.data.to);
  } catch (err) {
    console.error("Test email failed:", err);
    const message = err instanceof Error ? err.message : "Versturen mislukt.";
    return NextResponse.json(
      { error: `Resend kon de mail niet versturen: ${message}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
