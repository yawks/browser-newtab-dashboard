import { useState, useEffect, useRef } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { TasktroveConfig, TasktroveTask, TasktroveLabel, TasktroveProject } from './types';
import { fetchTasktroveTasks, fetchTasktroveLabels, fetchTasktroveProjects, updateTasktroveTask } from './api';
import { AlertCircle, Loader2, Check, Calendar, Flag, ListTodo, MessageSquare, Tag, Folder } from 'lucide-react';

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Reset time to compare dates only
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

  if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'yesterday';
  }
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'today';
  }
  if (dateOnly.getTime() === tomorrowOnly.getTime()) {
    return 'tomorrow';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function isDateOverdue(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function getPriorityColor(priority: number | null | undefined): string {
  switch (priority) {
    case 1:
      return 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30';
    case 2:
      return 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30';
    case 3:
      return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30';
  }
}

function getPriorityLabel(priority: number | null | undefined): string {
  if (priority === 1) return 'P1';
  if (priority === 2) return 'P2';
  if (priority === 3) return 'P3';
  return 'No priority';
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

  const loadData = async (forceRefresh: boolean = false) => {
      // Check if mock data is provided
      if (tasktroveConfig.mockData) {
        const mockTasks = tasktroveConfig.mockData.tasks || [];
        const mockLabels = tasktroveConfig.mockData.labels || [];
        const mockProjects = tasktroveConfig.mockData.projects || [];

        // Create maps for quick lookup
        const labelsMap = new Map<string, TasktroveLabel>();
        mockLabels.forEach(label => {
          labelsMap.set(label.id, label);
        });

        const projectsMap = new Map<string, TasktroveProject>();
        mockProjects.forEach(project => {
          projectsMap.set(project.id, project);
        });

        // Apply filters
        let filteredTasks = mockTasks;

        // Status filter
        if (tasktroveConfig.statusFilter) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          filteredTasks = filteredTasks.filter(task => {
            switch (tasktroveConfig.statusFilter) {
              case 'today': {
                if (task.completed) return false;
                if (!task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate <= today;
              }
              case 'upcoming': {
                if (task.completed) return false;
                if (!task.dueDate) return false;
                const upcomingDate = new Date(task.dueDate);
                upcomingDate.setHours(0, 0, 0, 0);
                return upcomingDate >= tomorrow;
              }
              case 'completed':
                return task.completed;
              case 'uncompleted':
                return !task.completed;
              default:
                return true;
            }
          });
        }

        // Project filter
        if (tasktroveConfig.projectIds && tasktroveConfig.projectIds.length > 0) {
          filteredTasks = filteredTasks.filter(task =>
            task.projectId && tasktroveConfig.projectIds!.includes(task.projectId)
          );
        }

        // Label filter
        if (tasktroveConfig.labelIds && tasktroveConfig.labelIds.length > 0) {
          filteredTasks = filteredTasks.filter(task =>
            task.labelIds.some(labelId => tasktroveConfig.labelIds!.includes(labelId))
          );
        }

        setTasks(filteredTasks);
        setLabels(labelsMap);
        setProjects(projectsMap);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Check if configuration is complete
      if (!tasktroveConfig.apiEndpoint || !tasktroveConfig.apiToken) {
        setError('Configuration incomplete. Please configure the widget in edit mode.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const cacheDuration = tasktroveConfig.cacheDuration ?? 3600;

        // Load all data in parallel
        const [fetchedTasks, fetchedLabels, fetchedProjects] = await Promise.all([
          fetchTasktroveTasks(tasktroveConfig, forceRefresh, frameId, cacheDuration),
          fetchTasktroveLabels(tasktroveConfig, forceRefresh, frameId, cacheDuration),
          fetchTasktroveProjects(tasktroveConfig, forceRefresh, frameId, cacheDuration),
        ]);

        console.log('TasktroveDashboardView - fetched tasks:', fetchedTasks);
        console.log('TasktroveDashboardView - fetched labels:', fetchedLabels);
        console.log('TasktroveDashboardView - fetched projects:', fetchedProjects);

        // Create maps for quick lookup
        const labelsMap = new Map<string, TasktroveLabel>();
        fetchedLabels.forEach(label => {
          labelsMap.set(label.id, label);
        });

        const projectsMap = new Map<string, TasktroveProject>();
        fetchedProjects.forEach(project => {
          projectsMap.set(project.id, project);
        });

        // Apply filters
        let filteredTasks = fetchedTasks;

        // Status filter
        if (tasktroveConfig.statusFilter) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          filteredTasks = filteredTasks.filter(task => {
            switch (tasktroveConfig.statusFilter) {
              case 'today': {
                if (task.completed) return false;
                if (!task.dueDate) return false;
                const taskDate = new Date(task.dueDate);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate <= today;
              }
              case 'upcoming': {
                if (task.completed) return false;
                if (!task.dueDate) return false;
                const upcomingDate = new Date(task.dueDate);
                upcomingDate.setHours(0, 0, 0, 0);
                return upcomingDate >= tomorrow;
              }
              case 'completed':
                return task.completed;
              case 'uncompleted':
                return !task.completed;
              default:
                return true;
            }
          });
        }

        // Project filter
        if (tasktroveConfig.projectIds && tasktroveConfig.projectIds.length > 0) {
          filteredTasks = filteredTasks.filter(task =>
            task.projectId && tasktroveConfig.projectIds!.includes(task.projectId)
          );
        }

        // Label filter
        if (tasktroveConfig.labelIds && tasktroveConfig.labelIds.length > 0) {
          filteredTasks = filteredTasks.filter(task =>
            task.labelIds.some(labelId => tasktroveConfig.labelIds!.includes(labelId))
          );
        }

        setTasks(filteredTasks);
        setLabels(labelsMap);
        setProjects(projectsMap);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
        setTasks([]);
        setLabels(new Map());
        setProjects(new Map());
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    loadData();

    // Only set up refresh interval if not using mock data
    if (!tasktroveConfig.mockData) {
      const interval = setInterval(() => loadData(false), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [tasktroveConfig.apiEndpoint, tasktroveConfig.apiToken, tasktroveConfig.statusFilter, tasktroveConfig.projectIds, tasktroveConfig.labelIds, tasktroveConfig.mockData]);

  // Register refresh function for Frame.tsx to call when refresh button is clicked
  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  useEffect(() => {
    if (frameId) {
      (globalThis as any)[`__pluginRefresh_${frameId}`] = () => loadDataRef.current(true);
      return () => {
        delete (globalThis as any)[`__pluginRefresh_${frameId}`];
      };
    }
  }, [frameId]);

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
    <div className="p-2 overflow-y-auto">
      {tasks.map((task, index) => {
        const dueDate = formatDate(task.dueDate);
        const isOverdue = isDateOverdue(task.dueDate);
        const priorityColor = getPriorityColor(task.priority);
        const priorityLabel = getPriorityLabel(task.priority);
        const subtasks = task.subtasks;
        const commentsCount = task.commentsCount;
        const labelIds = task.labelIds || [];
        const projectId = task.projectId;

        // Get label objects from IDs
        const taskLabels = labelIds
          .map(id => labels.get(id))
          .filter((label): label is TasktroveLabel => label !== undefined);

        // Get project object from ID
        const project = projectId ? projects.get(projectId) : null;

        const handleToggleComplete = async (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();

          const newCompleted = !task.completed;

          // Optimistic update
          setTasks(prevTasks =>
            prevTasks.map(t =>
              t.id === task.id ? { ...t, completed: newCompleted } : t
            )
          );

          try {
            // Update via API
            await updateTasktroveTask(tasktroveConfig, task.id, {
              completed: newCompleted,
            });
          } catch (err) {
            console.error('Failed to update task:', err);
            // Revert on error
            setTasks(prevTasks =>
              prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: task.completed } : t
              )
            );
          }
        };

        return (
          <div key={task.id}>
            {index > 0 && <div className="border-t border-border my-1" />}
            <div className="py-2">
            {/* First line: checkbox + title */}
            <div className="flex items-start gap-2 mb-2">
              <button
                type="button"
                onClick={handleToggleComplete}
                className="mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {task.completed ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <div className="w-4 h-4 border-2 border-muted-foreground rounded" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h4
                  className={`font-medium text-sm ${
                    task.completed ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {task.title || 'No title'}
                </h4>
              </div>
            </div>

            {/* Second line: flexible layout */}
            <div className="flex gap-3 items-center text-xs flex-wrap">
              {/* Left side: fixed elements */}
              <div className="flex gap-3 items-center">
                {/* Due date - only show if present */}
                {dueDate && (
                  <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>{dueDate}</span>
                  </div>
                )}

                {/* Priority - only show if present and valid (1, 2, or 3) */}
                {task.priority !== null && task.priority !== undefined && task.priority >= 1 && task.priority <= 3 && (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${priorityColor}`}>
                    <Flag className="w-3 h-3 flex-shrink-0" />
                    <span>{priorityLabel}</span>
                  </div>
                )}

                {/* Subtasks - only show if there are subtasks */}
                {subtasks.total > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ListTodo className="w-3 h-3 flex-shrink-0" />
                    <span>{subtasks.completed}/{subtasks.total}</span>
                  </div>
                )}

                {/* Comments - only show if present */}
                {commentsCount > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageSquare className="w-3 h-3 flex-shrink-0" />
                    <span>{commentsCount}</span>
                  </div>
                )}
              </div>

              {/* Right side: tags and project, aligned right */}
              <div className="flex gap-3 items-center ml-auto">
                {/* Tags/Labels - aligned right, before project */}
                {taskLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center justify-end">
                    {taskLabels.map((label) => (
                      <span
                        key={label.id}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs border whitespace-nowrap"
                        style={{
                          backgroundColor: label.color ? `${label.color}20` : undefined,
                          borderColor: label.color ? `${label.color}30` : undefined,
                          color: label.color || undefined,
                        }}
                      >
                        <Tag className="w-3 h-3 flex-shrink-0" />
                        <span>{label.name}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Project - always show, aligned right */}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Folder
                    className="w-3 h-3 flex-shrink-0"
                    style={{ color: project?.color || undefined }}
                  />
                  <span>{project?.name || 'No project'}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

