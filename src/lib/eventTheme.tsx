// Assigns a themed color gradient + decorative icon to an event based on
// keywords in its title, so recurring activity types (zwemmen, voetbal,
// paardrijden, Arabische les, ...) are visually distinguishable at a glance
// on the homepage and event page, without needing a real photo uploaded per
// event.

export type EventThemeName = "swim" | "ball" | "horse" | "book" | "star";

export type EventTheme = {
  gradient: string; // tailwind "from-... to-..." classes
  icon: EventThemeName;
};

const RULES: { test: RegExp; theme: EventTheme }[] = [
  { test: /zwem.*vrouw|vrouw.*zwem/i, theme: { gradient: "from-fuchsia-500 to-rose-400", icon: "swim" } },
  { test: /zwem/i, theme: { gradient: "from-sky-600 to-cyan-400", icon: "swim" } },
  { test: /voetbal/i, theme: { gradient: "from-emerald-600 to-lime-400", icon: "ball" } },
  { test: /paard/i, theme: { gradient: "from-amber-800 to-yellow-600", icon: "horse" } },
  { test: /arabisch/i, theme: { gradient: "from-amber-500 to-orange-400", icon: "book" } },
];

const FALLBACK: EventTheme = { gradient: "from-zinc-700 to-zinc-500", icon: "star" };

export function getEventTheme(title: string): EventTheme {
  for (const rule of RULES) {
    if (rule.test.test(title)) return rule.theme;
  }
  return FALLBACK;
}

export function EventThemeIcon({
  icon,
  className,
}: {
  icon: EventThemeName;
  className?: string;
}) {
  switch (icon) {
    case "swim":
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="46" cy="16" r="5" fill="currentColor" stroke="none" />
          <path d="M14 28c6-6 10-6 16 0s10 6 16 0" strokeLinecap="round" />
          <path d="M4 40c6-6 10-6 16 0s10 6 16 0 10-6 16 0" strokeLinecap="round" />
          <path d="M4 50c6-6 10-6 16 0s10 6 16 0 10-6 16 0" strokeLinecap="round" />
        </svg>
      );
    case "ball":
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="32" cy="32" r="26" />
          <path d="M32 14l10 8-4 12H26l-4-12z" fill="currentColor" stroke="none" />
          <path
            d="M12 26l8-4M12 42l8 6M52 26l-8-4M52 42l-8 6M22 58l4-10M42 58l-4-10"
            strokeLinecap="round"
          />
        </svg>
      );
    case "horse":
      return (
        <svg
          viewBox="0 0 64 64"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
        >
          <path d="M16 56V28a16 16 0 0132 0v28" />
          <circle cx="16" cy="40" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="48" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="48" cy="40" r="2.5" fill="currentColor" stroke="none" />
          <circle cx="48" cy="48" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "book":
      return (
        <svg
          viewBox="0 0 64 64"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M32 14c-6-4-14-4-20 0v34c6-4 14-4 20 0V14z" />
          <path d="M32 14c6-4 14-4 20 0v34c-6-4-14-4-20 0V14z" />
          <path d="M32 14v34" opacity="0.5" />
        </svg>
      );
    case "star":
    default:
      return (
        <svg
          viewBox="0 0 64 64"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 24a6 6 0 000 12v6a4 4 0 004 4h40a4 4 0 004-4v-6a6 6 0 000-12v-6a4 4 0 00-4-4H12a4 4 0 00-4 4v6z" />
          <path d="M26 16v32" strokeDasharray="4 4" />
        </svg>
      );
  }
}
