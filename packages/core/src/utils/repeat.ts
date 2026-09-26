import type { CalendarEvent } from '../types/event';
import type { RepeatConfig, RepeatOverride } from '../types/repeat';
import { dateAddDays, daysBetween, formatDateDisplay } from './dateHelpers';

// A series is one stored CalendarEvent (the base) whose `repeat` rule is not
// 'none'. Reads never see the base directly: they see virtual occurrences,
// each carrying the base's fields, that date's override, and a synthetic id
// `${seriesId}:${date}` (stable across renders — React keys, drag/resize and
// the edit sheet all key on it). Nothing here loops without a bound: a single
// date is O(1) per series, a range is O(days / interval).

const OVERRIDE_KEYS: (keyof RepeatOverride)[] =
  ['title', 'date', 'startMinute', 'durationMinutes', 'categoryId', 'notes'];

export function isSeries(e: CalendarEvent | null | undefined): e is CalendarEvent & { repeat: RepeatConfig } {
  return !!e?.repeat && e.repeat.mode !== 'none';
}

// Days between occurrences. The stored `interval` only matters for 'custom';
// the pre-pass-8 modal persisted `interval: 7` next to `mode: 'daily'`.
export function repeatInterval(r: RepeatConfig): number {
  if (r.mode === 'daily')  return 1;
  if (r.mode === 'weekly') return 7;
  if (r.mode === 'custom') return Math.max(1, Math.floor(r.interval ?? 7));
  return 0;
}

export function occurrenceId(seriesId: string, date: string): string {
  return `${seriesId}:${date}`;
}

// Series ids (`series-<nanoid>`) never contain ':', and dates never do either,
// so the last colon splits the two unambiguously.
export function parseOccurrenceId(id: string): { seriesId: string; date: string } | null {
  const i = id.lastIndexOf(':');
  if (i <= 0) return null;
  const seriesId = id.slice(0, i);
  const date     = id.slice(i + 1);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? { seriesId, date } : null;
}

export function findSeries(events: CalendarEvent[], seriesId: string): CalendarEvent | undefined {
  return events.find(e => e.seriesId === seriesId && isSeries(e));
}

// Only the fields an occurrence may differ in; `id`, `seriesId`, `repeat` and
// the todo link stay the base's.
export function pickOverride(patch: Partial<CalendarEvent>): RepeatOverride {
  const out: RepeatOverride = {};
  for (const k of OVERRIDE_KEYS) {
    if (patch[k] !== undefined) (out as Record<string, unknown>)[k] = patch[k];
  }
  return out;
}

function occurrenceIndex(base: CalendarEvent, r: RepeatConfig, date: string): number | null {
  const step = repeatInterval(r);
  if (step <= 0) return null;
  const d = daysBetween(base.date, date);
  if (d < 0 || d % step !== 0) return null;
  const n = d / step;
  if (r.count !== undefined && n >= Math.max(1, r.count)) return null;
  if (r.endDate && date > r.endDate) return null;
  return n;
}

function materialise(base: CalendarEvent, ruleDate: string, override: RepeatOverride | undefined): CalendarEvent {
  const seriesId = base.seriesId ?? base.id;
  return {
    ...base,
    ...override,
    id:       occurrenceId(seriesId, ruleDate),
    date:     override?.date ?? ruleDate,
    seriesId,
  };
}

// The occurrence the rule puts on `ruleDate`, or null if the rule does not
// reach it, it was deleted, or its override moved it to another day.
function occurrenceAtRuleDate(base: CalendarEvent, ruleDate: string): CalendarEvent | null {
  const r = base.repeat!;
  if (occurrenceIndex(base, r, ruleDate) === null) return null;
  if (r.exceptions?.includes(ruleDate)) return null;
  const ov = r.overrides?.[ruleDate];
  if (ov?.date && ov.date !== ruleDate) return null;
  return materialise(base, ruleDate, ov);
}

// Occurrences whose override moved them *onto* `date` from another rule date.
function movedOnto(base: CalendarEvent, date: string): CalendarEvent[] {
  const r = base.repeat!;
  if (!r.overrides) return [];
  const out: CalendarEvent[] = [];
  for (const ruleDate of Object.keys(r.overrides)) {
    const ov = r.overrides[ruleDate];
    if (ov.date !== date || ruleDate === date) continue;
    if (occurrenceIndex(base, r, ruleDate) === null) continue;
    if (r.exceptions?.includes(ruleDate)) continue;
    out.push(materialise(base, ruleDate, ov));
  }
  return out;
}

// Every occurrence of `base` that lands on `date`. O(1) plus the override count.
export function occurrencesOn(base: CalendarEvent, date: string): CalendarEvent[] {
  if (!isSeries(base)) return base.date === date ? [base] : [];
  const own = occurrenceAtRuleDate(base, date);
  const moved = movedOnto(base, date);
  return own ? [own, ...moved] : moved;
}

// Every occurrence of `base` with a display date in [from, to]. Bounded by the
// range, so a "forever" rule costs (to - from) / interval iterations.
export function expandSeries(base: CalendarEvent, from: string, to: string): CalendarEvent[] {
  if (!isSeries(base)) return base.date >= from && base.date <= to ? [base] : [];
  const r    = base.repeat;
  const step = repeatInterval(r);
  const out: CalendarEvent[] = [];

  // Jump straight to the first rule date at or after `from`.
  const lead = daysBetween(base.date, from);
  let n = lead > 0 ? Math.ceil(lead / step) : 0;
  for (;; n++) {
    const ruleDate = dateAddDays(base.date, n * step);
    if (ruleDate > to) break;
    if (occurrenceIndex(base, r, ruleDate) === null) break; // count / endDate reached
    const occ = occurrenceAtRuleDate(base, ruleDate);
    if (occ) out.push(occ);
  }
  // Overrides can move an occurrence into the range from a rule date outside it.
  if (r.overrides) {
    for (const ruleDate of Object.keys(r.overrides)) {
      const ov = r.overrides[ruleDate];
      if (!ov.date || ov.date === ruleDate || ov.date < from || ov.date > to) continue;
      if (occurrenceIndex(base, r, ruleDate) === null) continue;
      if (r.exceptions?.includes(ruleDate)) continue;
      out.push(materialise(base, ruleDate, ov));
    }
  }
  return out;
}

// The read-side replacement for `events.filter(e => e.date === date)`.
export function eventsOnDate(events: CalendarEvent[], date: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of events) {
    if (isSeries(e)) out.push(...occurrencesOn(e, date));
    else if (e.date === date) out.push(e);
  }
  return out;
}

export function eventsInRange(events: CalendarEvent[], from: string, to: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of events) out.push(...expandSeries(e, from, to));
  return out;
}

// Distinct dates in [from, to] that have at least one block (date-strip dots).
export function datesWithEvents(events: CalendarEvent[], from: string, to: string): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (isSeries(e)) for (const occ of expandSeries(e, from, to)) set.add(occ.date);
    else if (e.date >= from && e.date <= to) set.add(e.date);
  }
  return [...set];
}

// Human-readable rule: "daily × 4", "weekly until Fri, Oct 23", "every 3 days · forever".
export function describeRepeat(r: RepeatConfig | undefined): string {
  if (!r || r.mode === 'none') return '';
  const unit = r.mode === 'daily' ? 'daily'
    : r.mode === 'weekly' ? 'weekly'
    : `every ${repeatInterval(r)} days`;
  const end = r.count !== undefined ? ` × ${r.count}`
    : r.endDate ? ` until ${formatDateDisplay(r.endDate)}`
    : ' · forever';
  return unit + end;
}

// ── Store migration v1 → v2 ──────────────────────────────────────────────────
//
// Before pass 8 a repeating block was written as N concrete rows sharing a
// `seriesId` (ids `<base>`, `<base>-1`, …). This folds each group back into one
// base event + rule: `count` = rows the rule would have produced up to the last
// surviving row, a missing row on the way becomes an exception, a row whose
// fields differ from the base becomes an override, and a row whose date is
// not on the rule at all is kept as a standalone event. Events without a
// `seriesId` pass through untouched.
export function migrateMaterialisedSeries(events: CalendarEvent[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const groups = new Map<string, CalendarEvent[]>();

  for (const e of events) {
    if (e.seriesId && isSeries(e)) {
      const g = groups.get(e.seriesId);
      if (g) g.push(e); else groups.set(e.seriesId, [e]);
    } else if (e.seriesId) {
      // A seriesId with no usable rule was never valid; drop the link only.
      const { seriesId: _drop, ...rest } = e;
      out.push(rest);
    } else {
      out.push(e);
    }
  }

  for (const [seriesId, rows] of groups) {
    rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const base = rows[0];
    const rule = base.repeat!;
    const step = repeatInterval(rule);
    const last = rows[rows.length - 1].date;
    const byDate = new Map(rows.map(r => [r.date, r] as const));

    let count = 0;
    const exceptions: string[] = [];
    const overrides: Record<string, RepeatOverride> = {};

    for (let n = 0; ; n++) {
      const date = dateAddDays(base.date, n * step);
      if (date > last) break;
      count++;
      const row = byDate.get(date);
      if (!row) { exceptions.push(date); continue; }
      byDate.delete(date);
      const diff: RepeatOverride = {};
      if (row.title           !== base.title)           diff.title           = row.title;
      if (row.startMinute     !== base.startMinute)     diff.startMinute     = row.startMinute;
      if (row.durationMinutes !== base.durationMinutes) diff.durationMinutes = row.durationMinutes;
      if (row.categoryId      !== base.categoryId)      diff.categoryId      = row.categoryId;
      if ((row.notes ?? '')   !== (base.notes ?? ''))   diff.notes           = row.notes;
      if (Object.keys(diff).length) overrides[date] = diff;
    }

    // Rows off the rule (should not exist, but never lose data).
    for (const stray of byDate.values()) {
      const { seriesId: _s, repeat: _r, ...rest } = stray;
      out.push(rest);
    }

    const repeat: RepeatConfig = { mode: rule.mode, count };
    if (rule.mode === 'custom') repeat.interval = step;
    if (exceptions.length)          repeat.exceptions = exceptions;
    if (Object.keys(overrides).length) repeat.overrides = overrides;
    out.push({ ...base, seriesId, repeat });
  }

  return out;
}
