import { createMollieClient } from "@mollie/api-client";

// Server-only. Never expose MOLLIE_API_KEY to the browser.
export function getMollieClient() {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing MOLLIE_API_KEY environment variable.");
  }
  return createMollieClient({ apiKey });
}

export function formatEuroCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
