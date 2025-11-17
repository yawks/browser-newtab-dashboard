export type TasktroveStatusFilter = 'today' | 'upcoming' | 'completed' | 'uncompleted' | null;

export interface TasktroveConfig {
  apiEndpoint: string;
  apiToken: string;
  statusFilter?: TasktroveStatusFilter;
  projectIds?: string[];
  labelIds?: string[];
}

// Raw API response types
export interface TasktroveSubtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  estimation?: number;
}

export interface TasktroveComment {
  id: string;
  content: string;
  createdAt: string;
}

export interface TasktroveTaskRaw {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority?: number | null; // 1, 2, 3 or null
  dueDate?: string | null; // ISO date string (YYYY-MM-DD)
  dueTime?: string | null; // Time string (HH:mm:ss)
  projectId?: string | null;
  labels?: string[]; // Array of label IDs
  subtasks?: TasktroveSubtask[];
  comments?: TasktroveComment[];
  createdAt: string;
  completedAt?: string | null;
  recurring?: string | null;
  recurringMode?: string | null;
  estimation?: number;
}

export interface TasktroveApiResponse {
  tasks: TasktroveTaskRaw[];
  meta: {
    count: number;
    timestamp: string;
    version: string;
  };
}

// Additional types for labels and projects
export interface TasktroveLabel {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

export interface TasktroveProject {
  id: string;
  name: string;
  slug: string;
  color?: string;
  sections?: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    color?: string;
    type: string;
    items?: string[];
  }>;
}

export interface TasktroveLabelsResponse {
  labels: TasktroveLabel[];
  meta: {
    count: number;
    timestamp: string;
    version: string;
  };
}

export interface TasktroveProjectsResponse {
  projects: TasktroveProject[];
  meta: {
    count: number;
    timestamp: string;
    version: string;
  };
}

// Processed task type for display
export interface TasktroveTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
  priority?: number | null; // 1, 2, 3 or null
  subtasks: {
    completed: number;
    total: number;
  };
  commentsCount: number;
  labelIds: string[];
  projectId?: string | null;
}

