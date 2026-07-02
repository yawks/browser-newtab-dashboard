import { useState, useEffect, useRef, useCallback } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { TasktroveConfig, TasktroveTask, TasktroveLabel, TasktroveProject } from './types';
import { fetchTasktroveTasks, fetchTasktroveLabels, fetchTasktroveProjects, updateTasktroveTask } from './api';
import { TaskListRenderer } from '@/plugins/shared/TaskListRenderer';
import { applyStatusFilter } from '@/plugins/shared/task-utils';
import { AlertCircle, Loader2 } from 'lucide-react';

function getPriorityBadge(priority: number | null | undefined): { color: string; label: string } | null {
  if (!priority || priority < 1 || priority > 3) return null;
  const colors: Record<number, string> = {
    1: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
    2: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
    3: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
  };
  return { color: colors[priority], label: `P${priority}` };
}

export function TasktroveDashboardView({ config, frameId }: PluginComponentProps) {
  const tasktroveConfig = (config as unknown as TasktroveConfig & {
    mockData?: {
      tasks?: TasktroveTask[];
      labels?: TasktroveLabel[];
      projects?: TasktroveProject[];
    }
  }) || {
    apiEndpoint: '',
    apiToken: '',
    cacheDuration: 3600,
  };

  const [tasks, setTasks] = useState<TasktroveTask[]>([]);
  const [labels, setLabels] = useState<Map<string, TasktroveLabel>>(new Map());
  const [projects, setProjects] = useState<Map<string, TasktroveProject>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    if (tasktroveConfig.mockData) {
      const mockTasks = tasktroveConfig.mockData.tasks || [];
      const mockLabels = tasktroveConfig.mockData.labels || [];
      const mockProjects = tasktroveConfig.mockData.projects || [];

      const labelsMap = new Map<string, TasktroveLabel>();
      mockLabels.forEach(label => labelsMap.set(label.id, label));

      const projectsMap = new Map<string, TasktroveProject>();
      mockProjects.forEach(project => projectsMap.set(project.id, project));

      let filteredTasks = applyStatusFilter(mockTasks, tasktroveConfig.statusFilter);

      if (tasktroveConfig.projectIds && tasktroveConfig.projectIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.projectId && tasktroveConfig.projectIds!.includes(task.projectId)
        );
      }

      if (tasktroveConfig.labelIds && tasktroveConfig.labelIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.labelIds.some(id => tasktroveConfig.labelIds!.includes(id))
        );
      }

      setTasks(filteredTasks);
      setLabels(labelsMap);
      setProjects(projectsMap);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!tasktroveConfig.apiEndpoint || !tasktroveConfig.apiToken) {
      setError('Configuration incomplete. Please configure the widget in edit mode.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cacheDuration = tasktroveConfig.cacheDuration ?? 3600;

      const [fetchedTasks, fetchedLabels, fetchedProjects] = await Promise.all([
        fetchTasktroveTasks(tasktroveConfig, forceRefresh, frameId, cacheDuration),
        fetchTasktroveLabels(tasktroveConfig, forceRefresh, frameId, cacheDuration),
        fetchTasktroveProjects(tasktroveConfig, forceRefresh, frameId, cacheDuration),
      ]);

      const labelsMap = new Map<string, TasktroveLabel>();
      fetchedLabels.forEach(label => labelsMap.set(label.id, label));

      const projectsMap = new Map<string, TasktroveProject>();
      fetchedProjects.forEach(project => projectsMap.set(project.id, project));

      let filteredTasks = applyStatusFilter(fetchedTasks, tasktroveConfig.statusFilter);

      if (tasktroveConfig.projectIds && tasktroveConfig.projectIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.projectId && tasktroveConfig.projectIds!.includes(task.projectId)
        );
      }

      if (tasktroveConfig.labelIds && tasktroveConfig.labelIds.length > 0) {
        filteredTasks = filteredTasks.filter(task =>
          task.labelIds.some(id => tasktroveConfig.labelIds!.includes(id))
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

    if (!tasktroveConfig.mockData) {
      const interval = setInterval(() => loadData(false), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [tasktroveConfig.apiEndpoint, tasktroveConfig.apiToken, tasktroveConfig.statusFilter, tasktroveConfig.projectIds, tasktroveConfig.labelIds, tasktroveConfig.mockData]);

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

    updateTasktroveTask(tasktroveConfig, taskId, { completed: newCompleted }).catch(() => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: task.completed } : t));
    });
  }, [tasks, tasktroveConfig]);

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
