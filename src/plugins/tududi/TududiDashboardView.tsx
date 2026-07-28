import { useState, useEffect, useRef, useCallback } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { TududiConfig, TududiTask, TududiLabel, TududiProject, TUDUDI_STATUS, TUDUDI_PRIORITY } from './types';
import { fetchTududiTasks, fetchTududiTags, fetchTududiProjects, updateTududiTask } from './api';
import { TaskListRenderer } from '@/plugins/shared/TaskListRenderer';
import { applyStatusFilter } from '@/plugins/shared/task-utils';
import { AlertCircle, Loader2 } from 'lucide-react';

function getPriorityBadge(priority: number | null | undefined): { color: string; label: string } | null {
  switch (priority) {
    case TUDUDI_PRIORITY.HIGH: return { color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30', label: 'High' };
    case TUDUDI_PRIORITY.MEDIUM: return { color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30', label: 'Medium' };
    case TUDUDI_PRIORITY.LOW: return { color: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30', label: 'Low' };
    default: return null;
  }
}

export function TududiDashboardView({ config, frameId }: PluginComponentProps) {
  const tududiConfig = (config as unknown as TududiConfig) || {
    apiEndpoint: '',
    apiToken: '',
    cacheDuration: 3600,
  };

  const [tasks, setTasks] = useState<TududiTask[]>([]);
  const [labels, setLabels] = useState<Map<string, TududiLabel>>(new Map());
  const [projects, setProjects] = useState<Map<string, TududiProject>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a uid map for API calls (uid is used in PATCH /task/:uid)
  const taskUidMap = useRef<Map<string, string>>(new Map());

  const loadData = async (forceRefresh = false) => {
    if (!tududiConfig.apiEndpoint || !tududiConfig.apiToken) {
      setError('Configuration incomplete. Please configure the widget in edit mode.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cacheDuration = tududiConfig.cacheDuration ?? 3600;

      const [fetchedTasks, fetchedTags, fetchedProjects] = await Promise.all([
        fetchTududiTasks(tududiConfig, forceRefresh, frameId, cacheDuration),
        fetchTududiTags(tududiConfig, forceRefresh, frameId, cacheDuration),
        fetchTududiProjects(tududiConfig, forceRefresh, frameId, cacheDuration),
      ]);

      // Store uid mapping for PATCH calls
      fetchedTasks.forEach(t => {
        const uid = (t as any)._uid;
        if (uid) taskUidMap.current.set(t.id, uid);
      });

      const tagsMap = new Map<string, TududiLabel>();
      fetchedTags.forEach(tag => tagsMap.set(tag.id, tag));

      const projectsMap = new Map<string, TududiProject>();
      fetchedProjects.forEach(project => projectsMap.set(project.id, project));

      let filteredTasks = applyStatusFilter(fetchedTasks, tududiConfig.statusFilter);

      if (tududiConfig.projectIds && tududiConfig.projectIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.projectId && tududiConfig.projectIds!.includes(task.projectId)
        );
      }

      if (tududiConfig.tagIds && tududiConfig.tagIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.labelIds.some(id => tududiConfig.tagIds!.includes(id))
        );
      }

      setTasks(filteredTasks);
      setLabels(tagsMap);
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
  }, [tududiConfig.apiEndpoint, tududiConfig.apiToken, tududiConfig.statusFilter, tududiConfig.projectIds, tududiConfig.tagIds]);

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
    const uid = taskUidMap.current.get(taskId) || taskId;

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t));

    updateTududiTask(tududiConfig, uid, {
      status: newCompleted ? TUDUDI_STATUS.DONE : TUDUDI_STATUS.NOT_STARTED,
      completed_at: newCompleted ? new Date().toISOString() : null,
    }).catch(() => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: task.completed } : t));
    });
  }, [tasks, tududiConfig]);

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
