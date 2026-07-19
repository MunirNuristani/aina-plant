const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(isoDate: string): string {
  const seconds = (new Date(isoDate).getTime() - Date.now()) / 1000;

  if (Math.abs(seconds) < 60) {
    return "just now";
  }

  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return relativeTimeFormatter.format(Math.round(seconds / secondsInUnit), unit);
    }
  }

  return relativeTimeFormatter.format(Math.round(seconds / 60), "minute");
}

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatAxisTime(timestampMs: number, range: "24h" | "7d"): string {
  const date = new Date(timestampMs);
  return range === "24h"
    ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
