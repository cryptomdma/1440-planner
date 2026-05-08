import type { RepeatConfig } from './repeat';

export type CategoryId = 'deep' | 'meeting' | 'admin' | 'break' | 'personal';

export interface Category {
  id: CategoryId;
  label: string;
  color: string;
  bg: string;
}

export const CATEGORIES: Category[] = [
  { id: 'deep',     label: 'Deep Work', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)'  },
  { id: 'meeting',  label: 'Meeting',   color: '#38BDF8', bg: 'rgba(56,189,248,0.18)'  },
  { id: 'admin',    label: 'Admin',     color: '#A78BFA', bg: 'rgba(167,139,250,0.18)' },
  { id: 'break',    label: 'Break',     color: '#34D399', bg: 'rgba(52,211,153,0.18)'  },
  { id: 'personal', label: 'Personal',  color: '#FB923C', bg: 'rgba(251,146,60,0.18)'  },
];

export const PRIORITIES = [
  { id: 'high', label: 'High',   color: '#f87171' },
  { id: 'med',  label: 'Medium', color: '#fbbf24' },
  { id: 'low',  label: 'Low',    color: '#6b7280' },
] as const;

export const DESIGN_TOKENS = {
  bg0: '#07090f', bg1: '#0a0e18', bg2: '#0d1220', bg3: '#111827',
  border: '#1f2d42', borderHi: '#2d4460',
  L1: '#f1f5f9', L2: '#94a3b8', L3: '#64748b', L4: '#3d4f66',
  gridHr: '#1a2840', gridQtr: '#111e2e',
  amber: '#F59E0B',
  cyan: '#38BDF8',
} as const;

export const MINUTES_IN_DAY = 1440;
export const BLOCK_SIZE = 15;   // grid snap in minutes
export const PPM = 2.8;         // pixels per minute
export const RULER_W = 76;      // timeline ruler width in pixels

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;             // YYYY-MM-DD
  startMinute: number;      // 0–1439
  durationMinutes: number;
  categoryId: CategoryId;
  repeat?: RepeatConfig;
  seriesId?: string;        // links all occurrences of a repeat series
  linkedTodoId?: string;
  fromTodo?: boolean;
}

export interface EventLayoutSlot {
  column: number;
  totalColumns: number;
}
