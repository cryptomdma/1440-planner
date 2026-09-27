import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { Todo } from '../types/todo';

// Placeholder until the platform injects a real adapter via initTodoStorage().
// createJSONStorage() resolves its argument once, at store creation, so the real
// adapter must be swapped in through persist.setOptions() — reassigning a module
// variable silently never persisted anything.
const NOOP_STORAGE: StateStorage = {
  getItem:    () => null,
  setItem:    () => {},
  removeItem: () => {},
};

export function initTodoStorage(adapter: StateStorage) {
  useTodoStore.persist.setOptions({ storage: createJSONStorage(() => adapter) });
  void useTodoStore.persist.rehydrate();
}

interface TodoState {
  todos: Todo[];
  addTodo:              (todo: Todo) => void;
  updateTodo:           (id: string, patch: Partial<Todo>) => void;
  deleteTodo:           (id: string) => void;
  linkEventToTodo:      (todoId: string, eventId: string) => void;
  unlinkEventFromTodo:  (todoId: string) => void;
  // `date` is the occurrence being checked. For a repeating todo it is recorded
  // in `repeat.exceptions` (done dates) and the base row's status is untouched
  // apart from clearing its calendar link; for a plain todo it is ignored.
  setDone:              (todoId: string, done: boolean, date?: string) => void;
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      todos: [],

      addTodo: (todo) => set(s => ({ todos: [...s.todos, todo] })),

      updateTodo: (id, patch) =>
        set(s => ({ todos: s.todos.map(t => (t.id === id ? { ...t, ...patch } : t)) })),

      deleteTodo: (id) => set(s => ({ todos: s.todos.filter(t => t.id !== id) })),

      linkEventToTodo: (todoId, eventId) =>
        set(s => ({
          todos: s.todos.map(t =>
            t.id === todoId ? { ...t, linkedEventId: eventId, status: 'scheduled' as const } : t
          ),
        })),

      unlinkEventFromTodo: (todoId) =>
        set(s => ({
          todos: s.todos.map(t =>
            t.id === todoId ? { ...t, linkedEventId: undefined, status: 'pending' as const } : t
          ),
        })),

      setDone: (todoId, done, date) =>
        set(s => ({
          todos: s.todos.map(t => {
            if (t.id !== todoId) return t;
            if (date && t.repeat && t.repeat.mode !== 'none') {
              const exceptions = (t.repeat.exceptions ?? []).filter(d => d !== date);
              if (done) exceptions.push(date);
              const repeat = { ...t.repeat };
              if (exceptions.length) repeat.exceptions = exceptions; else delete repeat.exceptions;
              // Completing an occurrence closes out its block link so the next
              // occurrence starts unplaced; the block itself is left alone.
              return done
                ? { ...t, repeat, status: 'pending' as const, linkedEventId: undefined }
                : { ...t, repeat };
            }
            return { ...t, status: done ? ('done' as const) : ('pending' as const) };
          }),
        })),
    }),
    {
      name: '1440-planner-todos-v1',
      storage: createJSONStorage(() => NOOP_STORAGE),
      // Hydrated explicitly by initTodoStorage() once a real adapter exists
      skipHydration: true,
    }
  )
);
