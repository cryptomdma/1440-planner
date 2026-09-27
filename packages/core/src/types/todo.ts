import type { CategoryId } from './event';
import type { RepeatConfig } from './repeat';

export type Priority = 'high' | 'med' | 'low';
export type TodoStatus = 'pending' | 'scheduled' | 'done';

export interface Todo {
  id: string;
  title: string;
  priority: Priority;
  categoryId: CategoryId;
  durationMinutes: number;
  status: TodoStatus;
  notes?: string;
  linkedEventId?: string;
  // Repeat (pass 9). A repeating todo is stored once: `dueDate` anchors the rule
  // and `repeat.exceptions` holds the dates it was completed on. The backlog
  // shows the *current* occurrence only — see utils/todoRepeat.ts. Both fields
  // are optional so pre-pass-9 rows rehydrate untouched.
  dueDate?: string;      // YYYY-MM-DD; only meaningful with `repeat`
  repeat?: RepeatConfig;
}
