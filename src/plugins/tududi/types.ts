import type { DisplayTask, DisplayLabel, DisplayProject } from '@/plugins/shared/TaskListRenderer';

export type TududiStatusFilter = 'today' | 'upcoming' | 'completed' | 'uncompleted' | null;

export interface TududiConfig {
  apiEndpoint: string;
  apiToken: string;
  statusFilter?: TududiStatusFilter;
  projectIds?: string[];
  tagIds?: string[];
  cacheDuration?: number;
}

// Raw API response types
export interface TududiTagRaw {
  id: number;
  uid?: string;
  name: string;
}

export interface TududiTaskRaw {
  id: number;
  uid: string;
  name: string;
  note?: string;
  // 0=NOT_STARTED, 1=IN_PROGRESS, 2=DONE, 3=ARCHIVED, 4=WAITING, 5=CANCELLED, 6=PLANNED
  status: number;
  // 0=LOW, 1=MEDIUM, 2=HIGH
  priority?: number;
  due_date?: string | null;
  completed_at?: string | null;
  project_id?: number | null;
  Tags?: TududiTagRaw[];
}

export interface TududiProjectRaw {
  id: number;
  uid?: string;
  name: string;
  color?: string;
}

export const TUDUDI_STATUS = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  DONE: 2,
  ARCHIVED: 3,
  WAITING: 4,
  CANCELLED: 5,
  PLANNED: 6,
} as const;

export const TUDUDI_PRIORITY = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
} as const;

// Re-export display types for convenience
export type { DisplayTask as TududiTask, DisplayLabel as TududiLabel, DisplayProject as TududiProject };
