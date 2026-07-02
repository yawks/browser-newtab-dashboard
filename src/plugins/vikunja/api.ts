import type { DisplayLabel, DisplayProject, DisplayTask } from '@/plugins/shared/TaskListRenderer';
import { VikunjaConfig, VikunjaLabelRaw, VikunjaProjectRaw, VikunjaTaskRaw, VikunjaViewRaw } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

const REQUEST_TIMEOUT_MS = 30000;

function processTask(raw: VikunjaTaskRaw): DisplayTask {
  const dueDate = raw.due_date && new Date(raw.due_date).getFullYear() >= 2000
    ? raw.due_date
    : null;

  return {
    id: String(raw.id),
    title: raw.title,
    completed: raw.done,
    dueDate,
    priority: raw.priority ?? null,
    subtasks: { completed: 0, total: 0 },
    commentsCount: 0,
    labelIds: (raw.labels || []).map(l => String(l.id)),
    projectId: raw.project_id != null ? String(raw.project_id) : null,
  };
}

function rawLabelToDisplay(raw: VikunjaLabelRaw): DisplayLabel {
  return {
    id: String(raw.id),
    name: raw.title,
    color: raw.hex_color ? `#${raw.hex_color}` : undefined,
  };
}

function rawProjectToDisplay(raw: VikunjaProjectRaw): DisplayProject {
  return {
    id: String(raw.id),
    name: raw.title,
    color: raw.hex_color ? `#${raw.hex_color}` : undefined,
  };
}

async function vikunjaGet(url: string, token: string): Promise<Response> {
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
    let errorData: { message?: string } | undefined;
    try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
    throw new Error(errorData?.message || `HTTP ${response.status}: ${errorText}`);
  }

  return response;
}

async function vikunjaFetch<T>(url: string, token: string): Promise<T> {
  return (await vikunjaGet(url, token)).json();
}

// Fetches all pages of a paginated Vikunja endpoint using X-Pagination-Total-Results header
async function vikunjaFetchAll<T>(baseUrl: string, token: string, perPage = 50): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const response = await vikunjaGet(`${baseUrl}${sep}page=${page}&per_page=${perPage}`, token);

    const totalResults = parseInt(response.headers.get('X-Pagination-Total-Results') || '0', 10);
    const data: T[] | null = await response.json();
    const pageItems = Array.isArray(data) ? data : [];

    results.push(...pageItems);

    if (results.length >= totalResults || pageItems.length < perPage) break;
    page++;
  }

  return results;
}

async function fetchAllProjectTasks(
  apiEndpoint: string,
  token: string,
  projects: VikunjaProjectRaw[]
): Promise<VikunjaTaskRaw[]> {
  if (projects.length === 0) return [];

  // Fetch views for all projects in parallel
  const viewsPerProject = await Promise.all(
    projects.map(p =>
      vikunjaFetchAll<VikunjaViewRaw>(`${apiEndpoint}/projects/${p.id}/views`, token)
        .catch(() => [] as VikunjaViewRaw[])
    )
  );

  // For each project, pick the list view (view_kind=0) or fall back to the first one
  const pairs = projects.flatMap((p, i) => {
    const views = viewsPerProject[i];
    const view = views.find(v => v.view_kind === 0) ?? views[0];
    return view ? [{ projectId: p.id, viewId: view.id }] : [];
  });

  // Fetch tasks for all (project, view) pairs in parallel
  const tasksPerView = await Promise.all(
    pairs.map(({ projectId, viewId }) =>
      vikunjaFetchAll<VikunjaTaskRaw>(
        `${apiEndpoint}/projects/${projectId}/views/${viewId}/tasks`,
        token
      ).catch(() => [] as VikunjaTaskRaw[])
    )
  );

  // Flatten and deduplicate by task ID
  const seen = new Set<number>();
  const all: VikunjaTaskRaw[] = [];
  for (const tasks of tasksPerView) {
    for (const task of tasks) {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        all.push(task);
      }
    }
  }
  return all;
}

export async function fetchVikunjaTasks(
  config: VikunjaConfig,
  forceRefresh = false,
  frameId?: string,
  cacheDuration?: number
): Promise<DisplayTask[]> {
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<DisplayTask[]>(frameId, cacheDuration);
    if (cached) return cached;
  }

  const rawProjects = await vikunjaFetchAll<VikunjaProjectRaw>(
    `${config.apiEndpoint}/projects`,
    config.apiToken
  );

  const rawTasks = await fetchAllProjectTasks(config.apiEndpoint, config.apiToken, rawProjects);
  const tasks = rawTasks.map(processTask);

  if (frameId) await saveToCache(frameId, tasks);

  return tasks;
}

export async function fetchVikunjaLabels(
  config: VikunjaConfig,
  forceRefresh = false,
  frameId?: string,
  cacheDuration?: number
): Promise<DisplayLabel[]> {
  const cacheKey = `${frameId}_labels`;

  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<DisplayLabel[]>(cacheKey, cacheDuration);
    if (cached) return cached;
  }

  const rawLabels = await vikunjaFetch<VikunjaLabelRaw[]>(
    `${config.apiEndpoint}/labels?per_page=500`,
    config.apiToken
  );

  if (!Array.isArray(rawLabels)) {
    throw new Error('Invalid response format: expected a labels array');
  }

  const labels = rawLabels.map(rawLabelToDisplay);

  if (frameId) await saveToCache(cacheKey, labels);

  return labels;
}

export async function fetchVikunjaProjects(
  config: VikunjaConfig,
  forceRefresh = false,
  frameId?: string,
  cacheDuration?: number
): Promise<DisplayProject[]> {
  const cacheKey = `${frameId}_projects`;

  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<DisplayProject[]>(cacheKey, cacheDuration);
    if (cached) return cached;
  }

  const rawProjects = await vikunjaFetch<VikunjaProjectRaw[]>(
    `${config.apiEndpoint}/projects?per_page=500`,
    config.apiToken
  );

  if (!Array.isArray(rawProjects)) {
    throw new Error('Invalid response format: expected a projects array');
  }

  const projects = rawProjects.map(rawProjectToDisplay);

  if (frameId) await saveToCache(cacheKey, projects);

  return projects;
}

export async function updateVikunjaTask(
  config: VikunjaConfig,
  taskId: string,
  updates: Partial<VikunjaTaskRaw>
): Promise<void> {
  const response = await fetch(`${config.apiEndpoint}/tasks/${taskId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: { message?: string } | undefined;
    try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
    throw new Error(errorData?.message || `HTTP ${response.status}: ${errorText}`);
  }
}
