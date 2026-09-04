"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

type ScanResult = {
  status: "ok" | "invalid" | "unpaid" | "already_used" | "error";
  message: string;
};

export default function AdminScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const busyRef = useRef(false);

  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ time: string; message: string; ok: boolean }[]>(
    []
  );

  const handleScan = useCallback(async (ticketCode: string) => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketCode }),
      });
      const data = await res.json();

      const status: ScanResult["status"] = res.ok ? data.status : "error";
      const message: string = data.message ?? data.error ?? "Onbekende fout.";

      setResult({ status, message });
      setHistory((h) =>
        [
          {
            time: new Date().toLocaleTimeString("nl-BE"),
            message,
            ok: status === "ok",
          },
          ...h,
        ].slice(0, 20)
      );
    } catch {
      setResult({ status: "error", message: "Netwerkfout, probeer opnieuw." });
    } finally {
      // Brief cooldown so the same badge isn't scanned twice in a row.
      setTimeout(() => {
        busyRef.current = false;
      }, 1500);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (scanResult) => handleScan(scanResult.data),
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
      }
    );

    scanner.start().catch((err) => {
      setCameraError(
        "Kon de camera niet starten. Geef camera-toegang in de browser en herlaad de pagina."
      );
      console.error(err);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [handleScan]);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Check-in scanner
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Richt de camera op de QR-code van het ticket.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-800">
        <video ref={videoRef} className="w-full" muted playsInline />
      </div>

      {cameraError && (
        <p className="mt-3 text-sm text-red-500">{cameraError}</p>
      )}

      {result && (
        <div
          className={`mt-6 rounded-xl border p-4 text-center font-medium ${
            result.status === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          }`}
        >
          {result.message}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Recente scans
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {history.map((h, i) => (
              <li
                key={i}
                className={h.ok ? "text-emerald-600" : "text-red-500"}
              >
                {h.time} — {h.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
