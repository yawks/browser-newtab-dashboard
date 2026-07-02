import type { DisplayTask, DisplayLabel, DisplayProject } from '@/plugins/shared/TaskListRenderer';

export type VikunjaStatusFilter = 'today' | 'upcoming' | 'completed' | 'uncompleted' | null;

export interface VikunjaConfig {
  apiEndpoint: string;
  apiToken: string;
  statusFilter?: VikunjaStatusFilter;
  projectIds?: string[];
  labelIds?: string[];
  cacheDuration?: number;
}

// Raw API response types
export interface VikunjaLabelRaw {
  id: number;
  title: string;
  hex_color?: string;
}

export interface VikunjaTaskRaw {
  id: number;
  title: string;
  description?: string;
  done: boolean;
  priority?: number;
  due_date?: string | null;
  project_id?: number | null;
  labels?: VikunjaLabelRaw[];
  percent_done?: number;
}

export interface VikunjaProjectRaw {
  id: number;
  title: string;
  hex_color?: string;
}

export interface VikunjaViewRaw {
  id: number;
  title: string;
  view_kind: number; // 0=list, 1=gantt, 2=table, 3=kanban
  project_id: number;
}

// Re-export display types for convenience
export type { DisplayTask as VikunjaTask, DisplayLabel as VikunjaLabel, DisplayProject as VikunjaProject };
