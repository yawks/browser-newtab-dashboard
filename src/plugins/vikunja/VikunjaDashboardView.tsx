import { useState, useEffect, useRef, useCallback } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { VikunjaConfig, VikunjaTask, VikunjaLabel, VikunjaProject } from './types';
import { fetchVikunjaTasks, fetchVikunjaLabels, fetchVikunjaProjects, updateVikunjaTask } from './api';
import { TaskListRenderer } from '@/plugins/shared/TaskListRenderer';
import { applyStatusFilter } from '@/plugins/shared/task-utils';
import { AlertCircle, Loader2 } from 'lucide-react';

function getPriorityBadge(priority: number | null | undefined): { color: string; label: string } | null {
  switch (priority) {
    case 5: return { color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30', label: 'DO NOW' };
    case 4: return { color: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30', label: 'Urgent' };
    case 3: return { color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30', label: 'High' };
    case 2: return { color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30', label: 'Medium' };
    case 1: return { color: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30', label: 'Low' };
    default: return null;
  }
}

export function VikunjaDashboardView({ config, frameId }: PluginComponentProps) {
  const vikunjaConfig = (config as unknown as VikunjaConfig) || {
    apiEndpoint: '',
    apiToken: '',
    cacheDuration: 3600,
  };

  const [tasks, setTasks] = useState<VikunjaTask[]>([]);
  const [labels, setLabels] = useState<Map<string, VikunjaLabel>>(new Map());
  const [projects, setProjects] = useState<Map<string, VikunjaProject>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    if (!vikunjaConfig.apiEndpoint || !vikunjaConfig.apiToken) {
      setError('Configuration incomplete. Please configure the widget in edit mode.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cacheDuration = vikunjaConfig.cacheDuration ?? 3600;

      const [fetchedTasks, fetchedLabels, fetchedProjects] = await Promise.all([
        fetchVikunjaTasks(vikunjaConfig, forceRefresh, frameId, cacheDuration),
        fetchVikunjaLabels(vikunjaConfig, forceRefresh, frameId, cacheDuration),
        fetchVikunjaProjects(vikunjaConfig, forceRefresh, frameId, cacheDuration),
      ]);

      const labelsMap = new Map<string, VikunjaLabel>();
      fetchedLabels.forEach(label => labelsMap.set(label.id, label));

      const projectsMap = new Map<string, VikunjaProject>();
      fetchedProjects.forEach(project => projectsMap.set(project.id, project));

      let filteredTasks = applyStatusFilter(fetchedTasks, vikunjaConfig.statusFilter);

      if (vikunjaConfig.projectIds && vikunjaConfig.projectIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.projectId && vikunjaConfig.projectIds!.includes(task.projectId)
        );
      }

      if (vikunjaConfig.labelIds && vikunjaConfig.labelIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.labelIds.some(id => vikunjaConfig.labelIds!.includes(id))
        );
      }

      setTasks(filteredTasks);
      setLabels(labelsMap);
      setProjects(projectsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setTasks([]);
      setLabels(new Map());
      setProjects(new Map());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [vikunjaConfig.apiEndpoint, vikunjaConfig.apiToken, vikunjaConfig.statusFilter, vikunjaConfig.projectIds, vikunjaConfig.labelIds]);

  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  useEffect(() => {
    if (frameId) {
      (globalThis as any)[`__pluginRefresh_${frameId}`] = () => loadDataRef.current(true);
      return () => { delete (globalThis as any)[`__pluginRefresh_${frameId}`]; };
    }
  }, [frameId]);

  const handleToggleComplete = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t));

    updateVikunjaTask(vikunjaConfig, taskId, { done: newCompleted }).catch(() => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: task.completed } : t));
    });
  }, [tasks, vikunjaConfig]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-muted-foreground">
        <p className="text-sm">No tasks found</p>
      </div>
    );
  }

  return (
    <TaskListRenderer
      tasks={tasks}
      labels={labels}
      projects={projects}
      onToggleComplete={handleToggleComplete}
      getPriorityBadge={getPriorityBadge}
    />
  );
}
