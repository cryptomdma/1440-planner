import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';
import { initCalendarStorage } from '@1440/core';
import { initTodoStorage } from '@1440/core';
import { initSettingsStorage } from '@1440/core';

export const asyncStorageAdapter: StateStorage = {
  getItem:    (key) => AsyncStorage.getItem(key),
  setItem:    (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

// Call once in _layout.tsx before the navigation tree renders.
export function initAllStores(): void {
  initCalendarStorage(asyncStorageAdapter);
  initTodoStorage(asyncStorageAdapter);
  initSettingsStorage(asyncStorageAdapter);
}
