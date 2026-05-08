import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { Todo } from '../types/todo';

let _storage: StateStorage = {
  getItem:    () => null,
  setItem:    () => {},
  removeItem: () => {},
};

export function initTodoStorage(adapter: StateStorage) {
  _storage = adapter;
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
      storage: createJSONStorage(() => _storage),
    }
  )
);
