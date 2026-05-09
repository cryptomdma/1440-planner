import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { today } from '../utils/dateHelpers';

let _storage: StateStorage = {
  getItem:    () => null,
  setItem:    () => {},
  removeItem: () => {},
};

export function initSettingsStorage(adapter: StateStorage) {
  _storage = adapter;
}

interface SettingsState {
  countMode:          'up' | 'down';
  bufferMinutes:      number;
  defaultDuration:    number;
  wakeMinute:         number;
  sleepMinute:        number;
  highlightConflicts: boolean;
  rulerShowClock:     boolean;
  // selectedDate is NOT persisted — always resets to today on cold start
  selectedDate: string;

  setCountMode:    (m: 'up' | 'down') => void;
  setSelectedDate: (d: string) => void;
  updateSetting:   <K extends keyof Omit<SettingsState, 'selectedDate' | 'setCountMode' | 'setSelectedDate' | 'updateSetting'>>(
    key: K,
    value: SettingsState[K]
  ) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      countMode:          'up',
      bufferMinutes:      15,
      defaultDuration:    60,
      wakeMinute:         360,   // 6 AM
      sleepMinute:        1320,  // 10 PM
      highlightConflicts: true,
      rulerShowClock:     true,
      selectedDate:       today(),

      setCountMode:    (m) => set({ countMode: m }),
      setSelectedDate: (d) => set({ selectedDate: d }),
      updateSetting:   (key, value) => set({ [key]: value } as Partial<SettingsState>),
    }),
    {
      name: '1440-planner-settings-v1',
      storage: createJSONStorage(() => _storage),
      // Exclude selectedDate from persistence — always start on today
      partialize: (state) => ({
        countMode:          state.countMode,
        bufferMinutes:      state.bufferMinutes,
        defaultDuration:    state.defaultDuration,
        wakeMinute:         state.wakeMinute,
        sleepMinute:        state.sleepMinute,
        highlightConflicts: state.highlightConflicts,
        rulerShowClock:     state.rulerShowClock,
      }),
    }
  )
);
