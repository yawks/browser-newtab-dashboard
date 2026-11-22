import type { DisplayTask, DisplayLabel, DisplayProject } from '@/plugins/shared/TaskListRenderer';

export interface OpenTodoConfig {
  apiEndpoint: string;
  apiToken: string;
  statusFilter?: 'today' | 'upcoming' | 'completed' | 'uncompleted' | null;
  projectIds?: string[];
  tagIds?: string[];
  cacheDuration?: number;
}

export interface OpenTodoTaskRaw {
  id: string;
  title: string;
  completed_at?: number | null;
  deleted_at?: number | null;
  skipped?: boolean;
  due?: { date: string; time?: string; tz?: string } | null;
  priority?: number;
  labels?: string[];
  project_id?: string | null;
  parent_id?: string | null;
}

export interface OpenTodoLabelRaw {
  id: string;
  name: string;
  color?: string;
  deleted_at?: number | null;
}

export type OpenTodoProjectRaw = OpenTodoLabelRaw;
export type { DisplayTask as OpenTodoTask, DisplayLabel as OpenTodoLabel, DisplayProject as OpenTodoProject };
