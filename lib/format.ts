/**
 * Display formatters shared across the Requisition/Candidate/Application
 * views. All of them are deterministic given their input (no `Date.now()`
 * except where the caller passes `now`), so a server-rendered value and its
 * client rehydration agree.
 *
 * Locale is pinned to `en-GB` and timezone to UTC deliberately: recruiters,
 * hiring managers and panelists compare dates across a shared queue, so the
 * same record must read identically on every machine.
 */

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** `2026-09-14` → `14 Sep 2026`. */
export function formatDate(isoDate: string): string {
  return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Full ISO-8601 timestamp → `14 Sep 2026, 09:30`. */
export function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso));
}

/** Bytes → `1.4 MB`. Uses base-1000 units, matching what file pickers show. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["kB", "MB", "GB"];
  let value = bytes / 1000;
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unitIndex]}`;
}

/** Today as `YYYY-MM-DD`, for `min` on date inputs and default values. */
export function todayIsoDate(now = new Date()): string {
  const utc = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  return utc.toISOString().slice(0, 10);
}

/** Whole days a record has sat in its current state. Never negative. */
export function daysSince(iso: string, now = new Date()): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}
