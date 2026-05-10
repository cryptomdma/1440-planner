import type { CategoryId } from './event';

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
}
