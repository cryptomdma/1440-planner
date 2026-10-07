import { useMemo } from 'react';
import type { ResolvedCategory } from '../types/event';
import { useCategoryStore } from '../store/useCategoryStore';
import { resolveCategory, resolveCategories } from '../utils/category';

// The one way a component looks a category up by id. Always returns a
// renderable category — an unknown id gives UNCATEGORISED — so no style ever
// receives `undefined`. Selects the (referentially stable) array and resolves
// in a memo: a selector that built a new object per call would re-render on
// every store tick.
export function useCategory(id: string | undefined): ResolvedCategory {
  const categories = useCategoryStore(s => s.categories);
  return useMemo(() => resolveCategory(categories, id), [categories, id]);
}

export function useCategories(): ResolvedCategory[] {
  const categories = useCategoryStore(s => s.categories);
  return useMemo(() => resolveCategories(categories), [categories]);
}
