import { nanoid } from 'nanoid/non-secure';
import { useCalendarStore, useTodoStore } from '@1440/core';
import type { CalendarEvent, Todo } from '@1440/core';

// The one place a todo turns into a calendar block. Used by "AUTO" and
// "AUTO-SCHEDULE ALL" on the Tasks screen and by PICK placement on the Day
// screen, so the block shape and the todo link stay identical across all three.
// Lives here rather than in packages/core because core does not depend on nanoid.
export function eventFromTodo(todo: Todo, date: string, startMinute: number): CalendarEvent {
  return {
    id:              nanoid(),
    title:           todo.title,
    date,
    startMinute,
    durationMinutes: todo.durationMinutes,
    categoryId:      todo.categoryId,
    notes:           todo.notes,
    fromTodo:        true,
    linkedTodoId:    todo.id,
  };
}

// Adds the block and flips the todo to `scheduled` (linkEventToTodo does both
// the link and the status change). Returns the block that was created.
export function placeTodo(todo: Todo, date: string, startMinute: number): CalendarEvent {
  const ev = eventFromTodo(todo, date, startMinute);
  useCalendarStore.getState().addEvent(ev);
  useTodoStore.getState().linkEventToTodo(todo.id, ev.id);
  return ev;
}
