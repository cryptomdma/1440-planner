import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { today } from '../utils/dateHelpers';

// Placeholder until the platform injects a real adapter via initSettingsStorage().
// createJSONStorage() resolves its argument once, at store creation, so the real
// adapter must be swapped in through persist.setOptions() — reassigning a module
// variable (the previous approach) silently never persisted anything.
const NOOP_STORAGE: StateStorage = {
  getItem:    () => null,
  setItem:    () => {},
  removeItem: () => {},
};

export function initSettingsStorage(adapter: StateStorage) {
  useSettingsStore.persist.setOptions({ storage: createJSONStorage(() => adapter) });
  void useSettingsStore.persist.rehydrate();
}

interface SettingsState {
  countMode:          'up' | 'down';
  bufferMinutes:      number;
  defaultDuration:    number;
  wakeMinute:         number;
  sleepMinute:        number;
  highlightConflicts: boolean;
  rulerShowClock:     boolean;
  // Minutes before a block starts that its local notification fires (0 = at start)
  leadTimeMinutes:    number;
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
      leadTimeMinutes:    15,
      selectedDate:       today(),

      setCountMode:    (m) => set({ countMode: m }),
      setSelectedDate: (d) => set({ selectedDate: d }),
      updateSetting:   (key, value) => set({ [key]: value } as Partial<SettingsState>),
    }),
    {
      name: '1440-planner-settings-v1',
      storage: createJSONStorage(() => NOOP_STORAGE),
      // Hydrated explicitly by initSettingsStorage() once a real adapter exists
      skipHydration: true,
      // Exclude selectedDate from persistence — always start on today.
      // This is an explicit allowlist: a new setting that is not listed here
      // works for the session and then silently resets on restart.
      partialize: (state) => ({
        countMode:          state.countMode,
        bufferMinutes:      state.bufferMinutes,
        defaultDuration:    state.defaultDuration,
        wakeMinute:         state.wakeMinute,
        sleepMinute:        state.sleepMinute,
        highlightConflicts: state.highlightConflicts,
        rulerShowClock:     state.rulerShowClock,
        leadTimeMinutes:    state.leadTimeMinutes,
      }),
    }
  )
);
