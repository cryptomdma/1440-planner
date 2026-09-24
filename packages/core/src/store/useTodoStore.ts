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
  setDone:              (todoId: string, done: boolean) => void;
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

      setDone: (todoId, done) =>
        set(s => ({
          todos: s.todos.map(t =>
            t.id === todoId ? { ...t, status: done ? ('done' as const) : ('pending' as const) } : t
          ),
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
