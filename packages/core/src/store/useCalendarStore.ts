import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { CalendarEvent } from '../types/event';
import type { RepeatConfig, RepeatOverride, SeriesScope } from '../types/repeat';
import { dateAddDays } from '../utils/dateHelpers';
import {
  eventsOnDate, findSeries, isSeries, migrateMaterialisedSeries, parseOccurrenceId, pickOverride,
} from '../utils/repeat';
// Static import is safe: useTodoStore imports nothing from this module, so
// there is no cycle. The previous `import('./useTodoStore')` rejected at
// runtime on the device ("Possible unhandled promise rejection"), which meant
// deleting a block never returned its todo to `pending`.
import { useTodoStore } from './useTodoStore';

// Placeholder until the platform injects a real adapter via initCalendarStorage()
// (see services/storage.ts → initAllStores). createJSONStorage() resolves its
// argument once, at store creation, so the real adapter must be swapped in through
// persist.setOptions() — reassigning a module variable silently never persisted.
const NOOP_STORAGE: StateStorage = {
  getItem:    () => null,
  setItem:    () => {},
  removeItem: () => {},
};

export function initCalendarStorage(adapter: StateStorage) {
  useCalendarStore.persist.setOptions({ storage: createJSONStorage(() => adapter) });
  void useCalendarStore.persist.rehydrate();
}

// Persisted shape. Bumped to 2 in pass 8 when repeat series stopped being
// materialised rows; `migrate` below folds old rows back into base + rule.
const STORE_VERSION = 2;

interface CalendarState {
  // Stored events: plain blocks plus one *base* event per repeat series.
  // Read through eventsOnDate()/getEventsForDate(), never filtered by date
  // directly — a series' occurrences exist only at read time.
  events: CalendarEvent[];
  addEvent:             (event: CalendarEvent) => void;
  addEvents:            (events: CalendarEvent[]) => void;
  // `id` may be a plain event id or an occurrence id (`<seriesId>:<date>`);
  // the latter becomes an override on that series.
  updateEvent:          (id: string, patch: Partial<CalendarEvent>) => void;
  // Patches the base of a series (every occurrence). Keys in the patch are
  // also cleared from per-occurrence overrides so the change really reaches all.
  updateSeries:         (seriesId: string, patch: Partial<CalendarEvent>) => void;
  // Plain id → removed (and its todo unlinked). Occurrence id → an exception.
  deleteEvent:          (id: string) => void;
  // Undo of a single-occurrence delete.
  restoreOccurrence:    (id: string) => void;
  // "This and future": ends the rule the day before `fromDate` (deletes the
  // whole series if that leaves nothing).
  deleteSeriesFromDate: (seriesId: string, fromDate: string) => void;
  deleteSeries:         (seriesId: string) => void;
  // Dispatches on scope; plain ids ignore it.
  deleteWithScope:      (id: string, scope: SeriesScope) => void;
  getEventsForDate:     (date: string) => CalendarEvent[];
}

function patchSeries(
  events: CalendarEvent[],
  seriesId: string,
  fn: (base: CalendarEvent & { repeat: RepeatConfig }) => CalendarEvent | null,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of events) {
    if (e.seriesId === seriesId && isSeries(e)) {
      const next = fn(e);
      if (next) out.push(next);
    } else {
      out.push(e);
    }
  }
  return out;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (event) => set(s => ({ events: [...s.events, event] })),

      addEvents: (events) => set(s => ({ events: [...s.events, ...events] })),

      updateEvent: (id, patch) => {
        const occ = parseOccurrenceId(id);
        if (occ && findSeries(get().events, occ.seriesId)) {
          const override = pickOverride(patch);
          if (!Object.keys(override).length) return;
          set(s => ({
            events: patchSeries(s.events, occ.seriesId, base => ({
              ...base,
              repeat: {
                ...base.repeat,
                overrides: {
                  ...base.repeat.overrides,
                  [occ.date]: { ...base.repeat.overrides?.[occ.date], ...override },
                },
              },
            })),
          }));
          return;
        }
        set(s => ({ events: s.events.map(e => (e.id === id ? { ...e, ...patch } : e)) }));
      },

      updateSeries: (seriesId, patch) => {
        // Identity and rule-date are the base's own; never let a patch move them.
        const { id: _id, seriesId: _sid, date: _date, ...rest } = patch;
        set(s => ({
          events: patchSeries(s.events, seriesId, base => {
            const repeat: RepeatConfig = rest.repeat ?? base.repeat;
            let overrides = repeat.overrides;
            if (overrides) {
              const cleared: Record<string, RepeatOverride> = {};
              for (const [date, ov] of Object.entries(overrides)) {
                const kept: RepeatOverride = { ...ov };
                for (const k of Object.keys(rest)) delete (kept as Record<string, unknown>)[k];
                if (Object.keys(kept).length) cleared[date] = kept;
              }
              overrides = Object.keys(cleared).length ? cleared : undefined;
            }
            const nextRepeat: RepeatConfig = { ...repeat };
            if (overrides) nextRepeat.overrides = overrides; else delete nextRepeat.overrides;
            return { ...base, ...rest, repeat: nextRepeat };
          }),
        }));
      },

      deleteEvent: (id) => {
        const occ = parseOccurrenceId(id);
        if (occ && findSeries(get().events, occ.seriesId)) {
          set(s => ({
            events: patchSeries(s.events, occ.seriesId, base => {
              const exceptions = base.repeat.exceptions ?? [];
              const overrides  = { ...base.repeat.overrides };
              delete overrides[occ.date];
              const repeat: RepeatConfig = {
                ...base.repeat,
                exceptions: exceptions.includes(occ.date) ? exceptions : [...exceptions, occ.date],
              };
              if (Object.keys(overrides).length) repeat.overrides = overrides; else delete repeat.overrides;
              return { ...base, repeat };
            }),
          }));
          return;
        }
        const ev = get().events.find(e => e.id === id);
        set(s => ({ events: s.events.filter(e => e.id !== id) }));
        // A block that came from a todo hands the todo back to the backlog.
        if (ev?.linkedTodoId) {
          useTodoStore.getState().unlinkEventFromTodo(ev.linkedTodoId);
        }
      },

      restoreOccurrence: (id) => {
        const occ = parseOccurrenceId(id);
        if (!occ) return;
        set(s => ({
          events: patchSeries(s.events, occ.seriesId, base => {
            const exceptions = (base.repeat.exceptions ?? []).filter(d => d !== occ.date);
            const repeat: RepeatConfig = { ...base.repeat };
            if (exceptions.length) repeat.exceptions = exceptions; else delete repeat.exceptions;
            return { ...base, repeat };
          }),
        }));
      },

      deleteSeriesFromDate: (seriesId, fromDate) =>
        set(s => ({
          events: patchSeries(s.events, seriesId, base => {
            if (fromDate <= base.date) return null; // nothing would remain
            const endDate = dateAddDays(fromDate, -1);
            const repeat: RepeatConfig = { ...base.repeat, endDate };
            // A `count` that ends earlier still wins; one that ends later is now moot.
            if (repeat.exceptions) {
              const kept = repeat.exceptions.filter(d => d <= endDate);
              if (kept.length) repeat.exceptions = kept; else delete repeat.exceptions;
            }
            if (repeat.overrides) {
              const kept: Record<string, RepeatOverride> = {};
              for (const [d, ov] of Object.entries(repeat.overrides)) if (d <= endDate) kept[d] = ov;
              if (Object.keys(kept).length) repeat.overrides = kept; else delete repeat.overrides;
            }
            return { ...base, repeat };
          }),
        })),

      deleteSeries: (seriesId) =>
        set(s => ({ events: patchSeries(s.events, seriesId, () => null) })),

      deleteWithScope: (id, scope) => {
        const occ = parseOccurrenceId(id);
        if (!occ || !findSeries(get().events, occ.seriesId) || scope === 'one') {
          get().deleteEvent(id);
        } else if (scope === 'future') {
          get().deleteSeriesFromDate(occ.seriesId, occ.date);
        } else {
          get().deleteSeries(occ.seriesId);
        }
      },

      getEventsForDate: (date) => eventsOnDate(get().events, date),
    }),
    {
      name: '1440-planner-calendar-v1',
      storage: createJSONStorage(() => NOOP_STORAGE),
      // Hydrated explicitly by initCalendarStorage() once a real adapter exists.
      // The migration below runs inside that rehydrate(), not at module load.
      skipHydration: true,
      version: STORE_VERSION,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<CalendarState>;
        if (version < 2) {
          return { ...state, events: migrateMaterialisedSeries(state.events ?? []) } as CalendarState;
        }
        return state as CalendarState;
      },
    }
  )
);
