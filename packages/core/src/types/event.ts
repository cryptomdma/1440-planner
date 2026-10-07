import type { RepeatConfig } from './repeat';

// Since pass 11 a category id is any string: the five built-ins below keep
// their ids as the seed of the persisted category store, and user-made ones
// get a nanoid. Nothing in a persisted event or todo row had to change.
export type CategoryId = string;

export interface Category {
  id:    string;
  label: string;
  color: string;           // #RRGGBB — the stroke / label colour; `bg` is derived from it
  // Optional time range, minutes from midnight (0–1439). Shown in Settings and
  // drawn as a faint band on the Day grid. Both present or both absent.
  startMinute?: number;
  endMinute?:   number;
}

// What every lookup hands back: the stored fields plus the translucent fill.
export interface ResolvedCategory extends Category {
  bg: string;
}

// The seed for `useCategoryStore` on a fresh install. Not a lookup table —
// resolve ids through the store (`useCategory` / `resolveCategory`) so user
// categories and deleted ones are handled.
export const CATEGORIES: Category[] = [
  { id: 'deep',     label: 'Deep Work', color: '#F59E0B' },
  { id: 'meeting',  label: 'Meeting',   color: '#38BDF8' },
  { id: 'admin',    label: 'Admin',     color: '#A78BFA' },
  { id: 'break',    label: 'Break',     color: '#34D399' },
  { id: 'personal', label: 'Personal',  color: '#FB923C' },
];

// Swatches offered when a category is created or edited. Design data, not
// tokens: the first five are the seed colours so the built-ins round-trip.
export const CATEGORY_PALETTE = [
  '#F59E0B', '#38BDF8', '#A78BFA', '#34D399', '#FB923C',
  '#FB7185', '#F472B6', '#A3E635', '#2DD4BF', '#818CF8',
  '#F87171', '#FACC15',
] as const;

export const PRIORITIES = [
  { id: 'high', label: 'High',   color: '#f87171' },
  { id: 'med',  label: 'Medium', color: '#fbbf24' },
  { id: 'low',  label: 'Low',    color: '#6b7280' },
] as const;

export const DESIGN_TOKENS = {
  bg0: '#07090f', bg1: '#0a0e18', bg2: '#0d1220', bg3: '#111827',
  border: '#1f2d42', borderHi: '#2d4460',
  L1: '#f1f5f9', L2: '#94a3b8', L3: '#64748b', L4: '#3d4f66',
  gridHr: '#1a2840', gridQtr: '#111e2e',
  amber: '#F59E0B',
  cyan: '#38BDF8',
} as const;

export const MINUTES_IN_DAY = 1440;
export const BLOCK_SIZE = 15;   // grid snap in minutes
export const PPM = 2.8;         // pixels per minute
export const RULER_W = 76;      // timeline ruler width in pixels

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;             // YYYY-MM-DD
  startMinute: number;      // 0–1439
  durationMinutes: number;
  categoryId: CategoryId;
  notes?: string;
  repeat?: RepeatConfig;
  seriesId?: string;        // links all occurrences of a repeat series
  linkedTodoId?: string;
  fromTodo?: boolean;
}

export interface EventLayoutSlot {
  column: number;
  totalColumns: number;
}
