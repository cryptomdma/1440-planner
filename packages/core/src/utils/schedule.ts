import type { CalendarEvent, EventLayoutSlot } from '../types/event';
import type { Todo } from '../types/todo';
import { BLOCK_SIZE, MINUTES_IN_DAY } from '../types/event';
import { PRIORITIES } from '../types/event';
import { dateAddDays } from './dateHelpers';

// Returns a map of eventId → { column, totalColumns } for non-overlapping layout.
// Two-pass column-packing: first assigns columns greedily, then expands totalColumns
// so every event in a group knows the full column count.
export function computeLayout(events: CalendarEvent[]): Record<string, EventLayoutSlot> {
  const sorted  = [...events].sort((a, b) => a.startMinute - b.startMinute);
  const columns: number[] = []; // columns[c] = last end-minute placed
  const result: Record<string, EventLayoutSlot> = {};

  for (const ev of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= ev.startMinute) {
        columns[c] = ev.startMinute + ev.durationMinutes;
        result[ev.id] = { column: c, totalColumns: 1 };
        placed = true;
        break;
      }
    }
    if (!placed) {
      result[ev.id] = { column: columns.length, totalColumns: 1 };
      columns.push(ev.startMinute + ev.durationMinutes);
    }
  }

  // Second pass: each event expands totalColumns to cover all simultaneous overlaps
  for (const ev of sorted) {
    let maxCol = result[ev.id].column;
    for (const other of sorted) {
      if (other.id === ev.id) continue;
      const overlaps =
        other.startMinute < ev.startMinute + ev.durationMinutes &&
        other.startMinute + other.durationMinutes > ev.startMinute;
      if (overlaps) maxCol = Math.max(maxCol, result[other.id].column);
    }
    result[ev.id].totalColumns = maxCol + 1;
  }

  return result;
}

// Find the next 15-minute-aligned free slot at or after `afterMinute`.
// Caller must pre-inflate event durations by buffer before passing.
export function findNextFreeSlot(
  events: CalendarEvent[],
  afterMinute: number,
  durationMinutes: number
): number | null {
  const start = Math.ceil(afterMinute / BLOCK_SIZE) * BLOCK_SIZE;
  for (let m = start; m + durationMinutes <= MINUTES_IN_DAY; m += BLOCK_SIZE) {
    const conflict = events.some(
      ev => ev.startMinute < m + durationMinutes && ev.startMinute + ev.durationMinutes > m
    );
    if (!conflict) return m;
  }
  return null;
}

export interface SchedulePlacement {
  todo: Todo;
  startMinute: number;
}

// Priority-sorted auto-scheduling. Returns placement proposals; caller commits them.
export function autoScheduleQueue(
  todos: Todo[],
  existingEvents: CalendarEvent[],
  cursorMinute: number,
  bufferMinutes: number
): SchedulePlacement[] {
  const queue = [...todos].sort(
    (a, b) => PRIORITIES.findIndex(p => p.id === a.priority) - PRIORITIES.findIndex(p => p.id === b.priority)
  );

  let scratch = [...existingEvents];
  const placements: SchedulePlacement[] = [];
  const lastEnd = scratch.reduce((max, ev) => Math.max(max, ev.startMinute + ev.durationMinutes), 0);
  let cursor = Math.max(cursorMinute, lastEnd > 0 ? lastEnd + bufferMinutes : cursorMinute);

  for (const todo of queue) {
    const withBuf = scratch.map(ev => ({ ...ev, durationMinutes: ev.durationMinutes + bufferMinutes }));
    const start = findNextFreeSlot(withBuf, cursor, todo.durationMinutes);
    if (start === null) continue;

    // Push a synthetic event into scratch so subsequent todos respect this placement
    const synthetic: CalendarEvent = {
      id: `scratch-${todo.id}`,
      title: todo.title,
      date: '',
      startMinute: start,
      durationMinutes: todo.durationMinutes,
      categoryId: todo.categoryId,
    };
    scratch.push(synthetic);
    placements.push({ todo, startMinute: start });
    cursor = start + todo.durationMinutes + bufferMinutes;
  }

  return placements;
}

// Expand a base event with a repeat config into N CalendarEvent instances.
// Returns all occurrences (including the first) with a shared seriesId.
export function expandRepeat(base: CalendarEvent, seriesId: string): CalendarEvent[] {
  const repeat = base.repeat;
  if (!repeat || repeat.mode === 'none') return [{ ...base, seriesId }];

  const interval = repeat.mode === 'daily' ? 1
    : repeat.mode === 'weekly' ? 7
    : (repeat.interval ?? 7);
  const count = Math.max(1, repeat.count ?? 1);

  return Array.from({ length: count }, (_, i) => ({
    ...base,
    id: i === 0 ? base.id : `${base.id}-${i}`,
    date: dateAddDays(base.date, i * interval),
    seriesId,
  }));
}
