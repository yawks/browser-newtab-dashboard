import type { DisplayLabel, DisplayProject, DisplayTask } from '@/plugins/shared/TaskListRenderer';
import { TududiConfig, TududiProjectRaw, TududiTagRaw, TududiTaskRaw, TUDUDI_STATUS } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

const REQUEST_TIMEOUT_MS = 30000;

function processTask(raw: TududiTaskRaw): DisplayTask {
  const dueDate = raw.due_date && new Date(raw.due_date).getFullYear() >= 2000
    ? raw.due_date
    : null;

  return {
    id: String(raw.id),
    title: raw.name,
    completed: raw.status === TUDUDI_STATUS.DONE,
    dueDate,
    priority: raw.priority ?? null,
    subtasks: { completed: 0, total: 0 },
    commentsCount: 0,
    labelIds: (raw.Tags || []).map(t => String(t.id)),
    projectId: raw.project_id != null ? String(raw.project_id) : null,
    _uid: raw.uid,
  } as DisplayTask & { _uid: string };
}

function rawTagToDisplay(raw: TududiTagRaw): DisplayLabel {
  return {
    id: String(raw.id),
    name: raw.name,
  };
}

function rawProjectToDisplay(raw: TududiProjectRaw): DisplayProject {
  return {
    id: String(raw.id),
    name: raw.name,
    color: raw.color || undefined,
  };
}

async function tududiGet(url: string, token: string): Promise<Response> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: { message?: string; error?: string } | undefined;
    try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
    throw new Error(errorData?.message || errorData?.error || `HTTP ${response.status}: ${errorText}`);
  }

  return response;
}

async function tududiFetch<T>(url: string, token: string): Promise<T> {
  return (await tududiGet(url, token)).json();
}

// Fetches all tasks using limit/offset pagination
async function fetchAllTasks(apiEndpoint: string, token: string): Promise<TududiTaskRaw[]> {
  const limit = 100;
  let offset = 0;
  const results: TududiTaskRaw[] = [];

  while (true) {
    const data = await tududiFetch<TududiTaskRaw[] | { tasks?: TududiTaskRaw[] }>(
      `${apiEndpoint}/tasks?limit=${limit}&offset=${offset}`,
      token
    );

    const page = Array.isArray(data) ? data : (data.tasks ?? []);
    results.push(...page);

    if (page.length < limit) break;
    offset += limit;
  }

  return results;
}

export async function fetchTududiTasks(
  config: TududiConfig,
  forceRefresh = false,
  frameId?: string,
  cacheDuration?: number
): Promise<DisplayTask[]> {
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<DisplayTask[]>(frameId, cacheDuration);
    if (cached) return cached;
  }

  const rawTasks = await fetchAllTasks(config.apiEndpoint, config.apiToken);
  const tasks = rawTasks.map(processTask);

  if (frameId) await saveToCache(frameId, tasks);

  return tasks;
}

export async function fetchTududiTags(
  config: TududiConfig,
  forceRefresh = false,
  frameId?: string,
  cacheDuration?: number
): Promise<DisplayLabel[]> {
  const cacheKey = `${frameId}_tags`;

  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<DisplayLabel[]>(cacheKey, cacheDuration);
    if (cached) return cached;
  }

  const data = await tududiFetch<TududiTagRaw[] | { tags?: TududiTagRaw[] }>(
    `${config.apiEndpoint}/tags`,
    config.apiToken
  );

  const rawTags = Array.isArray(data) ? data : (data.tags ?? []);
  const tags = rawTags.map(rawTagToDisplay);

  if (frameId) await saveToCache(cacheKey, tags);

  return tags;
}

export async function fetchTududiProjects(
  config: TududiConfig,
  forceRefresh = false,
  frameId?: string,
  cacheDuration?: number
): Promise<DisplayProject[]> {
  const cacheKey = `${frameId}_projects`;

  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<DisplayProject[]>(cacheKey, cacheDuration);
    if (cached) return cached;
  }

  const data = await tududiFetch<TududiProjectRaw[] | { projects?: TududiProjectRaw[] }>(
    `${config.apiEndpoint}/projects`,
    config.apiToken
  );

  const rawProjects = Array.isArray(data) ? data : (data.projects ?? []);
  const projects = rawProjects.map(rawProjectToDisplay);

  if (frameId) await saveToCache(cacheKey, projects);

  return projects;
}

export async function updateTududiTask(
  config: TududiConfig,
  taskUid: string,
  updates: Partial<TududiTaskRaw>
): Promise<void> {
  const response = await fetch(`${config.apiEndpoint}/task/${taskUid}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: { message?: string; error?: string } | undefined;
    try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
    throw new Error(errorData?.message || errorData?.error || `HTTP ${response.status}: ${errorText}`);
  }
}
