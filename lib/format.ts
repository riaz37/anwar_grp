/**
 * Display formatters shared across the Project views. All of them are
 * deterministic given their input (no `Date.now()` except where the
 * caller passes `now`), so a server-rendered value and its client
 * rehydration agree.
 *
 * Locale is pinned to `en-GB` and timezone to UTC deliberately: AI
 * analysts, developers, and management compare dates across a shared
 * portfolio, so the same record must read identically on every machine.
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

/**
 * `10:30` → `10:30`. Interview times are stored and shown as a 24-hour local
 * wall clock (see the RECONCILIATION NOTE on `InterviewRound`), so this only
 * normalises shape — it never converts a zone.
 */
export function formatTime(hhmm: string): string {
  const [hours = "", minutes = ""] = hhmm.split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

/** `45` → `45 min`; `90` → `1 h 30 min`; `60` → `1 h`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Whole days a record has sat in its current state. Never negative. */
export function daysSince(iso: string, now = new Date()): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}
