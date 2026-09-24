import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { CalendarEvent } from '../types/event';
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

interface CalendarState {
  events: CalendarEvent[];
  addEvent:             (event: CalendarEvent) => void;
  addEvents:            (events: CalendarEvent[]) => void;
  updateEvent:          (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent:          (id: string) => void;
  deleteSeriesFromDate: (seriesId: string, fromDate: string) => void;
  getEventsForDate:     (date: string) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [],

      addEvent: (event) => set(s => ({ events: [...s.events, event] })),

      addEvents: (events) => set(s => ({ events: [...s.events, ...events] })),

      updateEvent: (id, patch) =>
        set(s => ({ events: s.events.map(e => (e.id === id ? { ...e, ...patch } : e)) })),

      deleteEvent: (id) => {
        const ev = get().events.find(e => e.id === id);
        set(s => ({ events: s.events.filter(e => e.id !== id) }));
        // A block that came from a todo hands the todo back to the backlog.
        if (ev?.linkedTodoId) {
          useTodoStore.getState().unlinkEventFromTodo(ev.linkedTodoId);
        }
      },

      deleteSeriesFromDate: (seriesId, fromDate) =>
        set(s => ({
          events: s.events.filter(
            e => !(e.seriesId === seriesId && e.date >= fromDate)
          ),
        })),

      getEventsForDate: (date) => get().events.filter(e => e.date === date),
    }),
    {
      name: '1440-planner-calendar-v1',
      storage: createJSONStorage(() => NOOP_STORAGE),
      // Hydrated explicitly by initCalendarStorage() once a real adapter exists
      skipHydration: true,
    }
  )
);
