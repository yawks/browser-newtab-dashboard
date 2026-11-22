import type { DisplayTask, DisplayLabel, DisplayProject } from '@/plugins/shared/TaskListRenderer';
import type { OpenTodoConfig, OpenTodoTaskRaw, OpenTodoLabelRaw, OpenTodoProjectRaw } from './types';
import { loadFromCache, saveToCache, clearCache } from '@/lib/cache';

const REQUEST_TIMEOUT_MS = 30000;

function apiBase(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

async function request<T>(config: OpenTodoConfig, path: string, updates?: object): Promise<T> {
  const response = await fetch(`${apiBase(config.apiEndpoint)}${path}`, {
    method: updates ? 'PATCH' : 'GET',
    headers: {
      Authorization: `Bearer ${config.apiToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: updates ? JSON.stringify(updates) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `HTTP ${response.status}`;
    try {
      const data = JSON.parse(text);
      message = data.error?.message || message;
    } catch { /* Non-JSON error response */ }
    throw new Error(message);
  }
  return response.json();
}

async function cached<T>(
  key: string | undefined, duration: number | undefined, force: boolean, load: () => Promise<T>,
): Promise<T> {
  if (key && duration && !force) {
    const value = await loadFromCache<T>(key, duration);
    if (value) return value;
  }
  const value = await load();
  if (key) await saveToCache(key, value);
  return value;
}

export async function fetchOpenTodoTasks(
  config: OpenTodoConfig, forceRefresh = false, frameId?: string, cacheDuration?: number,
): Promise<DisplayTask[]> {
  return cached(frameId, cacheDuration, forceRefresh, async () => {
    // OpenTodo returns the complete collection, without Tududi's limit/offset pagination.
    const data = await request<{ tasks: OpenTodoTaskRaw[] }>(config, '/tasks');
    const tasks = data.tasks.filter(task => task.deleted_at == null && !task.skipped);
    const subtasks = new Map<string, { completed: number; total: number }>();
    tasks.forEach(task => {
      if (!task.parent_id) return;
      const counts = subtasks.get(task.parent_id) || { completed: 0, total: 0 };
      counts.total++;
      if (task.completed_at != null) counts.completed++;
      subtasks.set(task.parent_id, counts);
    });
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      completed: task.completed_at != null,
      // Floating calendar dates must stay local, not shift a day in UTC-negative zones.
      dueDate: task.due ? `${task.due.date}T00:00:00` : null,
      priority: task.priority ?? 4,
      labelIds: task.labels || [],
      projectId: task.project_id ?? null,
      subtasks: subtasks.get(task.id) || { completed: 0, total: 0 },
      commentsCount: 0,
    }));
  });
}

export async function fetchOpenTodoTags(
  config: OpenTodoConfig, forceRefresh = false, frameId?: string, cacheDuration?: number,
): Promise<DisplayLabel[]> {
  return cached(frameId ? `${frameId}_tags` : undefined, cacheDuration, forceRefresh, async () => {
    const data = await request<{ labels: OpenTodoLabelRaw[] }>(config, '/labels');
    return data.labels.filter(label => label.deleted_at == null).map(label => ({
      id: label.id, name: label.name, color: label.color,
    }));
  });
}

export async function fetchOpenTodoProjects(
  config: OpenTodoConfig, forceRefresh = false, frameId?: string, cacheDuration?: number,
): Promise<DisplayProject[]> {
  return cached(frameId ? `${frameId}_projects` : undefined, cacheDuration, forceRefresh, async () => {
    const data = await request<{ projects: OpenTodoProjectRaw[] }>(config, '/projects');
    return data.projects.filter(project => project.deleted_at == null).map(project => ({
      id: project.id, name: project.name, color: project.color,
    }));
  });
}

export async function updateOpenTodoTask(
  config: OpenTodoConfig, taskId: string, completed: boolean, frameId?: string,
): Promise<OpenTodoTaskRaw> {
  const task = await request<OpenTodoTaskRaw>(config, `/tasks/${encodeURIComponent(taskId)}`, {
    completed_at: completed ? Date.now() : null,
  });
  if (frameId) await clearCache(frameId);
  return task;
}
