import { Check, Calendar, Flag, ListTodo, MessageSquare, Tag, Folder } from 'lucide-react';
import { formatDate, isDateOverdue } from './task-utils';

export interface DisplayTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
  priority?: number | null;
  subtasks: { completed: number; total: number };
  commentsCount: number;
  labelIds: string[];
  projectId?: string | null;
}

export interface DisplayLabel {
  id: string;
  name: string;
  color?: string;
}

export interface DisplayProject {
  id: string;
  name: string;
  color?: string;
}

interface TaskListRendererProps {
  tasks: DisplayTask[];
  labels: Map<string, DisplayLabel>;
  projects: Map<string, DisplayProject>;
  onToggleComplete: (taskId: string) => void;
  getPriorityBadge: (priority: number | null | undefined) => { color: string; label: string } | null;
}

export function TaskListRenderer({ tasks, labels, projects, onToggleComplete, getPriorityBadge }: TaskListRendererProps) {
  return (
    <div className="p-2 overflow-y-auto">
      {tasks.map((task, index) => {
        const dueDate = formatDate(task.dueDate);
        const isOverdue = isDateOverdue(task.dueDate);
        const priorityBadge = getPriorityBadge(task.priority);
        const subtasks = task.subtasks;
        const commentsCount = task.commentsCount;

        const taskLabels = task.labelIds
          .map(id => labels.get(id))
          .filter((label): label is DisplayLabel => label !== undefined);

        const project = task.projectId ? projects.get(task.projectId) : null;

        return (
          <div key={task.id}>
            {index > 0 && <div className="border-t border-border my-1" />}
            <div className="py-2">
              <div className="flex items-start gap-2 mb-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleComplete(task.id);
                  }}
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

              <div className="flex gap-3 items-center text-xs flex-wrap">
                <div className="flex gap-3 items-center">
                  {dueDate && (
                    <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{dueDate}</span>
                    </div>
                  )}

                  {priorityBadge && (
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${priorityBadge.color}`}>
                      <Flag className="w-3 h-3 flex-shrink-0" />
                      <span>{priorityBadge.label}</span>
                    </div>
                  )}

                  {subtasks.total > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <ListTodo className="w-3 h-3 flex-shrink-0" />
                      <span>{subtasks.completed}/{subtasks.total}</span>
                    </div>
                  )}

                  {commentsCount > 0 && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span>{commentsCount}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 items-center ml-auto">
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
