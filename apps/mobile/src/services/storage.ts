import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';
import {
  initCalendarStorage, initTodoStorage, initSettingsStorage, initCategoryStorage,
} from '@1440/core';

export const asyncStorageAdapter: StateStorage = {
  getItem:    (key) => AsyncStorage.getItem(key),
  setItem:    (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

// Call once in _layout.tsx before the navigation tree renders. Every store
// listed here must also be in the hydration gate there (`hasHydrated()`), or
// the app renders before that store's data exists.
export function initAllStores(): void {
  initCalendarStorage(asyncStorageAdapter);
  initTodoStorage(asyncStorageAdapter);
  initSettingsStorage(asyncStorageAdapter);
  initCategoryStorage(asyncStorageAdapter);
}
