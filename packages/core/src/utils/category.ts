import type { Category, ResolvedCategory, CalendarEvent } from '../types/event';
import { DESIGN_TOKENS } from '../types/event';
import type { Todo } from '../types/todo';
import { minuteToTimeStr } from './time';

// The fill alpha every block / chip uses — the one number that keeps
// overlapping blocks legible against the grid (docs/DESIGN_TOKENS.md).
const BG_ALPHA = 0.18;

// `#RRGGBB` → `rgba(r,g,b,0.18)`. Anything unparsable gets the neutral fill so
// a bad colour string degrades to "grey", never to an invalid style.
export function categoryBg(color: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return `rgba(100,116,139,${BG_ALPHA})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${BG_ALPHA})`;
}

// What an id that no category matches resolves to: a stray id from an old
// backup, or a row whose category was deleted without a reassign. Visible,
// neutral, and never `undefined` on a style.
export const UNCATEGORISED: ResolvedCategory = {
  id:    '',
  label: 'Uncategorised',
  color: DESIGN_TOKENS.L3,
  bg:    categoryBg(DESIGN_TOKENS.L3),
};

export function resolveCategory(categories: readonly Category[], id: string | undefined): ResolvedCategory {
  const cat = id ? categories.find(c => c.id === id) : undefined;
  return cat ? { ...cat, bg: categoryBg(cat.color) } : UNCATEGORISED;
}

export function resolveCategories(categories: readonly Category[]): ResolvedCategory[] {
  return categories.map(c => ({ ...c, bg: categoryBg(c.color) }));
}

// Generic so `resolved.filter(hasRange)` keeps the ResolvedCategory type.
export function hasRange<T extends Category>(c: T): c is T & { startMinute: number; endMinute: number } {
  return typeof c.startMinute === 'number' && typeof c.endMinute === 'number' && c.endMinute > c.startMinute;
}

// `6:00 AM – 12:00 PM`, or '' when the category has no range.
export function describeRange(c: Category): string {
  return hasRange(c) ? `${minuteToTimeStr(c.startMinute)} – ${minuteToTimeStr(c.endMinute)}` : '';
}

// How much a category is referenced, for the delete prompt. A series counts
// once (its base row) plus any occurrence override that re-categorised itself.
export function countCategoryUse(events: readonly CalendarEvent[], todos: readonly Todo[], id: string) {
  let blocks = 0;
  for (const e of events) {
    if (e.categoryId === id) blocks++;
    for (const ov of Object.values(e.repeat?.overrides ?? {})) if (ov.categoryId === id) blocks++;
  }
  const tasks = todos.filter(t => t.categoryId === id).length;
  return { blocks, tasks };
}
