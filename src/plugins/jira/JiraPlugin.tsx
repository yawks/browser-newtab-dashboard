import { ListTodo } from 'lucide-react';
import type { Plugin } from '@/types/plugin';
import { JiraDashboardView } from './JiraDashboardView';
import { JiraEditView } from './JiraEditView';

export const JiraPlugin: Plugin = {
  metadata: { id: 'jira', name: 'Jira Cloud', description: 'View Jira issues matching a JQL filter', icon: 'jira', version: '1.0.0' },
  DashboardView: JiraDashboardView,
  EditView: JiraEditView,
  IconComponent: ListTodo,
};
