import type { Todo, TodoStatus } from '../types/todo';
import type { RepeatConfig } from '../types/repeat';
import { lastRuleDateOnOrBefore } from './repeat';

// A repeating todo is stored once (Decisions on record, 2026-09-26). The
// backlog never lists its occurrences: it shows ONE row for the current
// occurrence — the last rule date on or before today, or the anchor while
// that is still ahead — and `repeat.exceptions` holds the dates that row was
// checked on. Nothing here is a loop: one occurrence is O(1) from the rule.

export function isRepeatingTodo(t: Todo | null | undefined): t is Todo & { repeat: RepeatConfig; dueDate: string } {
  return !!t?.repeat && t.repeat.mode !== 'none' && !!t.dueDate;
}

// The occurrence date the backlog speaks for on `date`.
export function todoOccurrenceDate(todo: Todo & { repeat: RepeatConfig; dueDate: string }, date: string): string {
  if (todo.dueDate > date) return todo.dueDate;
  return lastRuleDateOnOrBefore({ date: todo.dueDate, repeat: todo.repeat }, date) ?? todo.dueDate;
}

export interface ResolvedTodo {
  status: TodoStatus;
  occurrenceDate?: string;  // set for repeating todos only
}

// What a todo *is* on `date`: a plain todo is its stored status; a repeating
// one is `done` when the current occurrence is in `exceptions`, otherwise its
// stored status (a stale base `done` — from before repeat was switched on —
// reads as pending, since completion is per-date now).
export function resolveTodo(todo: Todo, date: string): ResolvedTodo {
  if (!isRepeatingTodo(todo)) return { status: todo.status };
  const occurrenceDate = todoOccurrenceDate(todo, date);
  if (todo.repeat.exceptions?.includes(occurrenceDate)) return { status: 'done', occurrenceDate };
  return { status: todo.status === 'done' ? 'pending' : todo.status, occurrenceDate };
}
