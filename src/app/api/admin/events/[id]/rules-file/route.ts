import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRole } from "@/lib/auth";

const BUCKET = "event-rules";
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Uploads the rules document (a PDF or a photo of the printed rules) to a
 * public Supabase Storage bucket and points the event at it. Public because
 * the file is linked straight from the public event page.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if ((await getRole()) !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  // Which of the two documents this upload is: the rules shown before
  // ordering, or the practical info shown on the ticket afterwards.
  const kind = form?.get("kind") === "info" ? "info" : "rules";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand meegestuurd." }, { status: 400 });
  }

  const extension = ALLOWED[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Enkel PDF, JPG, PNG of WEBP." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Het bestand is te groot (max 8 MB)." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const path = `${id}/${kind}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Rules upload failed:", uploadError);
    const missingBucket = uploadError.message.toLowerCase().includes("bucket");
    return NextResponse.json(
      {
        error: missingBucket
          ? "De opslagmap bestaat nog niet. Run supabase/migrations/0014_event_rules.sql in de Supabase SQL Editor."
          : `Uploaden mislukt: ${uploadError.message}`,
      },
      { status: missingBucket ? 409 : 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: event, error } = await supabase
    .from("events")
    .update(
      kind === "info" ? { info_file_url: publicUrl } : { rules_file_url: publicUrl }
    )
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event, url: publicUrl });
}
