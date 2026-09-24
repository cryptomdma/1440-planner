import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { CalendarEvent } from '../types/event';

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
        // Lazily unlink any todo that referenced this event (avoids circular import)
        if (ev?.linkedTodoId) {
          // Dynamic import avoids circular dep at module scope
          import('./useTodoStore').then(({ useTodoStore }) => {
            useTodoStore.getState().unlinkEventFromTodo(ev.linkedTodoId!);
          });
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
