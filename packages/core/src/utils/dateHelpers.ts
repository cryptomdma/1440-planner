// All functions call new Date() fresh — never cache at module level to avoid
// stale values on long-running sessions.

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function dateAddDays(d: string, n: number): string {
  const dt = new Date(d + 'T12:00:00');
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
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
