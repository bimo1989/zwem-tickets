"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatScanCode, normalizeScanCode } from "@/lib/scanCode";

/**
 * The front door for volunteers at the entrance. Same login endpoint as the
 * admin, but this page only talks about scan codes — nothing about an admin
 * area they have no business in.
 */
export default function ScanLoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: normalizeScanCode(code) }),
    });

    if (res.ok) {
      router.push("/admin/scan");
      router.refresh();
      return;
    }

    setError("Deze code werkt niet. Vraag de organisator om een nieuwe.");
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo-icon.jpg"
            alt="MC Attawassul"
            width={400}
            height={400}
            className="h-12 w-12 rounded-full"
          />
          <h1 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Tickets scannen
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Typ de scan-code die je van de organisator kreeg.
          </p>
        </div>

        <input
          // Uppercase letters and digits only, so phone keyboards don't
          // autocapitalize or autocorrect the code into something else.
          value={formatScanCode(normalizeScanCode(code))}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABCD-2345"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={9}
          className="mt-6 w-full rounded-md border border-zinc-300 px-3 py-3 text-center font-mono text-xl tracking-widest uppercase dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          required
        />

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || normalizeScanCode(code).length === 0}
          className="mt-4 h-12 w-full rounded-full bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "Bezig..." : "Start de scanner"}
        </button>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Je blijft 12 uur ingelogd. Daarna typ je de code opnieuw.
        </p>
      </form>
    </div>
  );
}
