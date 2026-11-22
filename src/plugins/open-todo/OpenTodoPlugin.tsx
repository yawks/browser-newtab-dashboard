import { ClipboardList } from 'lucide-react';
import { Plugin } from '@/types/plugin';
import { OpenTodoDashboardView } from './OpenTodoDashboardView';
import { OpenTodoEditView } from './OpenTodoEditView';

export const OpenTodoPlugin: Plugin = {
  metadata: {
    id: 'open-todo',
    name: 'Open Todo',
    description: 'View and manage OpenTodo tasks',
    icon: 'open-todo',
    version: '1.0.0',
  },
  DashboardView: OpenTodoDashboardView,
  EditView: OpenTodoEditView,
  IconComponent: ClipboardList,
};
