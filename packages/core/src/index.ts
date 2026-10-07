// Types
export type { RepeatMode, RepeatConfig, RepeatOverride, SeriesScope } from './types/repeat';
export type { CategoryId, Category, ResolvedCategory, CalendarEvent, EventLayoutSlot } from './types/event';
// CATEGORIES is deliberately not exported: it is the category store's seed,
// not a lookup table. Resolve ids through useCategory() / resolveCategory().
export { CATEGORY_PALETTE, PRIORITIES, DESIGN_TOKENS, MINUTES_IN_DAY, BLOCK_SIZE, PPM, RULER_W } from './types/event';
export type { Priority, TodoStatus, Todo } from './types/todo';

// Utils
export { minuteToTimeStr, getCurrentMinute, clockToMinute, formatDuration, polarToCart } from './utils/time';
export { today, dateAddDays, daysBetween, formatDateDisplay, isToday } from './utils/dateHelpers';
export { computeLayout, findNextFreeSlot, autoScheduleQueue } from './utils/schedule';
export type { SchedulePlacement } from './utils/schedule';
export {
  isSeries, repeatInterval, occurrenceId, parseOccurrenceId, findSeries,
  occurrencesOn, expandSeries, eventsOnDate, eventsInRange, datesWithEvents,
  describeRepeat, migrateMaterialisedSeries, lastRuleDateOnOrBefore,
} from './utils/repeat';
export type { Repeatable } from './utils/repeat';
export { isRepeatingTodo, todoOccurrenceDate, resolveTodo } from './utils/todoRepeat';
export type { ResolvedTodo } from './utils/todoRepeat';
export {
  categoryBg, resolveCategory, resolveCategories, hasRange, describeRange,
  countCategoryUse, UNCATEGORISED,
} from './utils/category';

// Stores
export { useCalendarStore, initCalendarStorage } from './store/useCalendarStore';
export { useTodoStore, initTodoStorage } from './store/useTodoStore';
export { useSettingsStore, initSettingsStorage } from './store/useSettingsStore';
export { useCategoryStore, initCategoryStorage } from './store/useCategoryStore';

// Hooks
export { useCurrentMinute } from './hooks/useCurrentMinute';
export { useCategory, useCategories } from './hooks/useCategory';
