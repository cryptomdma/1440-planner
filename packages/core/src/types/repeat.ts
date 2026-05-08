export type RepeatMode = 'none' | 'daily' | 'weekly' | 'custom';

export interface RepeatConfig {
  mode: RepeatMode;
  interval?: number;   // days between occurrences (used for 'custom'; 7 for 'weekly')
  weekdays?: number[]; // 0-6, for multi-day weekly variants (future)
  endDate?: string;    // YYYY-MM-DD termination date
  count?: number;      // total occurrences including first
}
