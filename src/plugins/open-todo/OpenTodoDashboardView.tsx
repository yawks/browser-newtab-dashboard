import { useState, useEffect, useRef, useCallback } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import type { OpenTodoConfig, OpenTodoTask, OpenTodoLabel, OpenTodoProject } from './types';
import { fetchOpenTodoTasks, fetchOpenTodoTags, fetchOpenTodoProjects, updateOpenTodoTask } from './api';
import { TaskListRenderer } from '@/plugins/shared/TaskListRenderer';
import { applyStatusFilter } from '@/plugins/shared/task-utils';
import { AlertCircle, Loader2 } from 'lucide-react';

function getPriorityBadge(priority: number | null | undefined): { color: string; label: string } | null {
  switch (priority) {
    case 1: return { color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30', label: 'High' };
    case 2: return { color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30', label: 'Medium' };
    case 3: return { color: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30', label: 'Low' };
    default: return null;
  }
}

export function OpenTodoDashboardView({ config, frameId }: PluginComponentProps) {
  const openTodoConfig = (config as unknown as OpenTodoConfig) || { apiEndpoint: '', apiToken: '' };
  const { apiEndpoint, apiToken, statusFilter, projectIds, tagIds, cacheDuration = 3600 } = openTodoConfig;
  const [tasks, setTasks] = useState<OpenTodoTask[]>([]);
  const [labels, setLabels] = useState<Map<string, OpenTodoLabel>>(new Map());
  const [projects, setProjects] = useState<Map<string, OpenTodoProject>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const pendingTasks = useRef(new Set<string>());

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!apiEndpoint || !apiToken) {
      setError('Configuration incomplete. Please configure the widget in edit mode.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const serviceConfig = { apiEndpoint, apiToken };
      const [fetchedTasks, fetchedTags, fetchedProjects] = await Promise.all([
        fetchOpenTodoTasks(serviceConfig, forceRefresh, frameId, cacheDuration),
        fetchOpenTodoTags(serviceConfig, forceRefresh, frameId, cacheDuration),
        fetchOpenTodoProjects(serviceConfig, forceRefresh, frameId, cacheDuration),
      ]);
      setTasks(fetchedTasks);
      setLabels(new Map(fetchedTags.map(tag => [tag.id, tag])));
      setProjects(new Map(fetchedProjects.map(project => [project.id, project])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setTasks([]);
      setLabels(new Map());
      setProjects(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [apiEndpoint, apiToken, cacheDuration, frameId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (frameId) {
      (globalThis as any)[`__pluginRefresh_${frameId}`] = () => loadData(true);
      return () => { delete (globalThis as any)[`__pluginRefresh_${frameId}`]; };
    }
  }, [frameId, loadData]);

  const handleToggleComplete = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || pendingTasks.current.has(taskId)) return;
    pendingTasks.current.add(taskId);
    setUpdateError(null);
    const completed = !task.completed;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t));
    updateOpenTodoTask({ apiEndpoint, apiToken }, taskId, completed, frameId)
      // Reload the server result: completing a recurring task may advance its due date.
      .then(() => loadData(true))
      .catch(err => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: task.completed } : t));
        setUpdateError(err instanceof Error ? err.message : 'Failed to update task');
      })
      .finally(() => pendingTasks.current.delete(taskId));
  }, [tasks, apiEndpoint, apiToken, frameId, loadData]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full p-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const filteredTasks = applyStatusFilter(tasks, statusFilter).filter(task =>
    (!projectIds?.length || (task.projectId && projectIds.includes(task.projectId))) &&
    (!tagIds?.length || task.labelIds.some(id => tagIds.includes(id)))
  );

  return (
    <>
      {updateError && <p role="alert" className="p-2 text-sm text-destructive">{updateError}</p>}
      {filteredTasks.length === 0 ? (
        <div className="flex items-center justify-center h-full p-4 text-muted-foreground">
          <p className="text-sm">No tasks found</p>
        </div>
      ) : (
        <TaskListRenderer tasks={filteredTasks} labels={labels} projects={projects}
          onToggleComplete={handleToggleComplete} getPriorityBadge={getPriorityBadge} />
      )}
    </>
  );
}
