import { ClipboardList } from 'lucide-react';
import { Plugin } from '@/types/plugin';
import { TududiDashboardView } from './TududiDashboardView';
import { TududiEditView } from './TududiEditView';

export const TududiPlugin: Plugin = {
  metadata: {
    id: 'tududi',
    name: 'Tududi',
    description: 'View and manage Tududi tasks',
    icon: 'tududi',
    version: '1.0.0',
  },
  DashboardView: TududiDashboardView,
  EditView: TududiEditView,
  IconComponent: ClipboardList,
};
