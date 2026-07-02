import { ClipboardList } from 'lucide-react';
import { Plugin } from '@/types/plugin';
import { VikunjaDashboardView } from './VikunjaDashboardView';
import { VikunjaEditView } from './VikunjaEditView';

export const VikunjaPlugin: Plugin = {
  metadata: {
    id: 'vikunja',
    name: 'Vikunja',
    description: 'View and manage Vikunja tasks',
    icon: 'vikunja',
    version: '1.0.0',
  },
  DashboardView: VikunjaDashboardView,
  EditView: VikunjaEditView,
  IconComponent: ClipboardList,
};
