import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { Category } from '../types/event';
import { CATEGORIES } from '../types/event';
// Static imports only in core (CLAUDE.md). No cycle: neither store imports
// this one — the dependency runs category → calendar → todo.
import { useCalendarStore } from './useCalendarStore';
import { useTodoStore } from './useTodoStore';

// Placeholder until the platform injects a real adapter via initCategoryStorage().
// createJSONStorage() resolves its argument once, at store creation, so the real
// adapter must be swapped in through persist.setOptions() — reassigning a module
// variable silently never persisted anything.
const NOOP_STORAGE: StateStorage = {
  getItem:    () => null,
  setItem:    () => {},
  removeItem: () => {},
};

export function initCategoryStorage(adapter: StateStorage) {
  useCategoryStore.persist.setOptions({ storage: createJSONStorage(() => adapter) });
  void useCategoryStore.persist.rehydrate();
}

interface CategoryState {
  categories: Category[];
  addCategory:    (cat: Category) => void;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  // Removes the category and moves every block and todo on it to `reassignTo`
  // (series overrides included), so no row is left pointing at a dead id.
  // The last remaining category cannot be deleted; an unknown or identical
  // `reassignTo` falls back to the first other category.
  deleteCategory: (id: string, reassignTo: string) => void;
}

export const useCategoryStore = create<CategoryState>()(
  persist(
    (set, get) => ({
      // The seed is the initial state, so a fresh install has the five
      // built-ins before and after its first (empty) hydration.
      categories: CATEGORIES,

      addCategory: (cat) => set(s => ({ categories: [...s.categories, cat] })),

      updateCategory: (id, patch) =>
        set(s => ({
          categories: s.categories.map(c => {
            if (c.id !== id) return c;
            const next: Category = { ...c, ...patch };
            // A range is both bounds or neither; drop stray halves so the
            // persisted row never carries an orphan.
            if (typeof next.startMinute !== 'number' || typeof next.endMinute !== 'number') {
              delete next.startMinute;
              delete next.endMinute;
            }
            return next;
          }),
        })),

      deleteCategory: (id, reassignTo) => {
        const { categories } = get();
        if (categories.length <= 1 || !categories.some(c => c.id === id)) return;
        const target = categories.find(c => c.id === reassignTo && c.id !== id)
          ?? categories.find(c => c.id !== id)!;
        useCalendarStore.getState().reassignCategory(id, target.id);
        useTodoStore.getState().reassignCategory(id, target.id);
        set(s => ({ categories: s.categories.filter(c => c.id !== id) }));
      },
    }),
    {
      name: '1440-planner-categories-v1',
      storage: createJSONStorage(() => NOOP_STORAGE),
      // Hydrated explicitly by initCategoryStorage() once a real adapter exists
      skipHydration: true,
      partialize: (state) => ({ categories: state.categories }),
      // Runs after the persisted value is merged and before hasHydrated()
      // flips, so the hydration gate in _layout.tsx never sees an empty list.
      onRehydrateStorage: () => (state) => {
        if (state && state.categories.length === 0) {
          useCategoryStore.setState({ categories: CATEGORIES });
        }
      },
    }
  )
);
