// Turns a phone number into the digits-only, country-code-prefixed format
// WhatsApp's "click to chat" links require (no spaces, no leading + or 0).
// Defaults to Belgium (32) when the number is given in local format
// (starting with a single 0), since that's this club's primary audience.
export function normalizePhoneForWhatsApp(
  raw: string,
  defaultCountryCode = "32"
): string | null {
  let digits = raw.trim().replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = defaultCountryCode + digits.slice(1);
  }

  if (!/^\d{8,15}$/.test(digits)) return null;
  return digits;
}

// Builds a "click to chat" link — no WhatsApp account, API key, or approval
// process needed. Opening it starts a chat in the admin's own WhatsApp
// (Web or app) with the message pre-filled; the admin still presses send.
export function buildWhatsAppLink(phone: string, message: string): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
