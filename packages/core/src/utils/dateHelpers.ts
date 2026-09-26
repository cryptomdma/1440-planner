// All functions call new Date() fresh — never cache at module level to avoid
// stale values on long-running sessions.

// Local-calendar YYYY-MM-DD. Never use toISOString() for this: it yields the
// UTC date, which is already "tomorrow" during the evening west of UTC (and
// still "yesterday" in the morning east of it).
function toLocalISODate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today(): string {
  return toLocalISODate(new Date());
}

export function dateAddDays(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return toLocalISODate(dt);
}

// Whole days from `a` to `b` (negative when `b` is earlier). Noon anchors sidestep
// DST transitions, which would otherwise make a day 23 or 25 hours long.
export function daysBetween(a: string, b: string): number {
  const ta = new Date(a + 'T12:00:00').getTime();
  const tb = new Date(b + 'T12:00:00').getTime();
  return Math.round((tb - ta) / 86400000);
}

export function formatDateDisplay(d: string): string {
  const dt  = new Date(d + 'T12:00:00');
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (dt.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return dt.toLocaleDateString('en-US', opts);
}

export function isToday(d: string): boolean {
  return d === today();
}
