export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

  if (dateOnly.getTime() === yesterdayOnly.getTime()) return 'yesterday';
  if (dateOnly.getTime() === todayOnly.getTime()) return 'today';
  if (dateOnly.getTime() === tomorrowOnly.getTime()) return 'tomorrow';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function isDateOverdue(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getFullYear() < 2000) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

export function applyStatusFilter<T extends { completed: boolean; dueDate?: string | null }>(
  tasks: T[],
  statusFilter: 'today' | 'upcoming' | 'completed' | 'uncompleted' | null | undefined
): T[] {
  if (!statusFilter) return tasks;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tasks.filter(task => {
    switch (statusFilter) {
      case 'today': {
        if (task.completed) return false;
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        if (taskDate.getFullYear() < 2000) return false;
        taskDate.setHours(0, 0, 0, 0);
        return taskDate <= today;
      }
      case 'upcoming': {
        if (task.completed) return false;
        if (!task.dueDate) return false;
        const upcomingDate = new Date(task.dueDate);
        if (upcomingDate.getFullYear() < 2000) return false;
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
