import { TasktroveConfig, TasktroveTask, TasktroveApiResponse, TasktroveTaskRaw, TasktroveLabel, TasktroveProject, TasktroveLabelsResponse, TasktroveProjectsResponse } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

const REQUEST_TIMEOUT_SECS = 30000; // 30 seconds in milliseconds

function processTask(rawTask: TasktroveTaskRaw): TasktroveTask {
  const subtasks = rawTask.subtasks || [];
  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const totalSubtasks = subtasks.length;
  
  const commentsCount = rawTask.comments?.length || 0;

  return {
    id: rawTask.id,
    title: rawTask.title,
    completed: rawTask.completed,
    dueDate: rawTask.dueDate || null,
    priority: rawTask.priority || null,
    subtasks: {
      completed: completedSubtasks,
      total: totalSubtasks,
    },
    commentsCount,
    labelIds: rawTask.labels || [],
    projectId: rawTask.projectId || null,
  };
}

export async function fetchTasktroveTasks(
  config: TasktroveConfig,
  forceRefresh: boolean = false,
  frameId?: string,
  cacheDuration?: number
): Promise<TasktroveTask[]> {
  // Try to load from cache first
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<TasktroveTask[]>(frameId, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  const url = `${config.apiEndpoint}/tasks`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_SECS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (errorData.error || errorData.message) {
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data: TasktroveApiResponse = await response.json();

  // Process the tasks from the API response
  if (data && Array.isArray(data.tasks)) {
    const tasks = data.tasks.map(processTask);

    // Save to cache if frameId is provided
    if (frameId) {
      await saveToCache(frameId, tasks);
    }

    return tasks;
  }

  throw new Error('Invalid response format: expected a tasks array');
}

export async function fetchTasktroveLabels(
  config: TasktroveConfig,
  forceRefresh: boolean = false,
  frameId?: string,
  cacheDuration?: number
): Promise<TasktroveLabel[]> {
  // Try to load from cache first (use frameId_labels as cache key)
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<TasktroveLabel[]>(`${frameId}_labels`, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  const url = `${config.apiEndpoint}/labels`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_SECS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (errorData.error || errorData.message) {
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data: TasktroveLabelsResponse = await response.json();

  if (data && Array.isArray(data.labels)) {
    const labels = data.labels;

    // Save to cache if frameId is provided
    if (frameId) {
      await saveToCache(`${frameId}_labels`, labels);
    }

    return labels;
  }

  throw new Error('Invalid response format: expected a labels array');
}

export async function fetchTasktroveProjects(
  config: TasktroveConfig,
  forceRefresh: boolean = false,
  frameId?: string,
  cacheDuration?: number
): Promise<TasktroveProject[]> {
  // Try to load from cache first (use frameId_projects as cache key)
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<TasktroveProject[]>(`${frameId}_projects`, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  const url = `${config.apiEndpoint}/projects`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_SECS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (errorData.error || errorData.message) {
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data: TasktroveProjectsResponse = await response.json();

  if (data && Array.isArray(data.projects)) {
    const projects = data.projects;

    // Save to cache if frameId is provided
    if (frameId) {
      await saveToCache(`${frameId}_projects`, projects);
    }

    return projects;
  }

  throw new Error('Invalid response format: expected a projects array');
}

export async function updateTasktroveTask(
  config: TasktroveConfig,
  taskId: string,
  updates: Partial<TasktroveTaskRaw>
): Promise<TasktroveTaskRaw> {
  const url = `${config.apiEndpoint}/tasks`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: taskId,
      ...updates,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_SECS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (errorData.error || errorData.message) {
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data: TasktroveTaskRaw = await response.json();
  return data;
}

