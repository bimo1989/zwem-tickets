"use client";

import { useState } from "react";

/**
 * Deleting a stored API key is not something to do on one stray click, so it
 * works like deleting an event: a panel opens and you have to type the phrase
 * before the button becomes usable.
 */
export default function ConfirmDeleteButton({
  triggerLabel,
  phrase,
  description,
  confirmLabel,
  onConfirm,
}: {
  triggerLabel: string;
  phrase: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const matches = text.trim().toLowerCase() === phrase;

  function close() {
    setOpen(false);
    setText("");
  }

  async function handleConfirm() {
    if (!matches) return;
    setBusy(true);
    await onConfirm();
    setBusy(false);
    close();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
      <p className="text-sm text-red-700 dark:text-red-400">
        {description} Typ{" "}
        <code className="rounded bg-red-100 px-1 dark:bg-red-900">{phrase}</code> om
        te bevestigen.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={phrase}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm dark:border-red-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          onClick={handleConfirm}
          disabled={!matches || busy}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Bezig..." : confirmLabel}
        </button>
        <button
          onClick={close}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Annuleer
        </button>
      </div>
    </div>
  );
}
