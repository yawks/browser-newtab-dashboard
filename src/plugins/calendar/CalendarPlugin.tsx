import { Calendar } from 'lucide-react';
import { CalendarDashboardView } from './CalendarDashboardView';
import { CalendarEditView } from './CalendarEditView';
import { Plugin } from '@/types/plugin';

export const CalendarPlugin: Plugin = {
  metadata: {
    id: 'calendar',
    name: 'Calendar',
    description: 'Affichez vos événements de calendrier (Google Calendar, iCal)',
    icon: 'calendar',
    version: '2.0.0',
  },
  DashboardView: CalendarDashboardView,
  EditView: CalendarEditView,
  IconComponent: Calendar,
};
