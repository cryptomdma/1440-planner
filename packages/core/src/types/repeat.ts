import type { CalendarEvent } from './event';

export type RepeatMode = 'none' | 'daily' | 'weekly' | 'custom';

// Fields of an occurrence that may differ from the series' base event.
// `date` moves that one occurrence to another day; it keeps its rule-date key.
export type RepeatOverride = Partial<
  Pick<CalendarEvent, 'title' | 'date' | 'startMinute' | 'durationMinutes' | 'categoryId' | 'notes'>
>;

// A series is stored once — its base event plus this rule — and expanded into
// virtual occurrences at read time (utils/repeat.ts). "Forever" is the absence
// of both `endDate` and `count`; expansion is always bounded by the caller's
// date range, never by the rule.
export interface RepeatConfig {
  mode: RepeatMode;
  interval?: number;   // days between occurrences ('custom' only; daily = 1, weekly = 7)
  weekdays?: number[]; // 0-6, for multi-day weekly variants (future)
  endDate?: string;    // YYYY-MM-DD, inclusive
  count?: number;      // total occurrences including the first
  // Per-series edits. Both are keyed by the occurrence's *rule* date — the date
  // the rule would put it on — which is also the tail of its synthetic id.
  exceptions?: string[];                     // occurrences deleted one by one
  overrides?: Record<string, RepeatOverride>; // occurrences edited one by one
}

// How far a delete on a series occurrence reaches.
export type SeriesScope = 'one' | 'future' | 'all';
