import { Calendar } from 'lucide-react';
import { GoogleCalendarDashboardView } from './GoogleCalendarDashboardView';
import { GoogleCalendarEditView } from './GoogleCalendarEditView';
import { Plugin } from '@/types/plugin';

export const GoogleCalendarPlugin: Plugin = {
  metadata: {
    id: 'googlecalendar',
    name: 'Google Calendar',
    description: 'Affichez vos événements Google Calendar',
    icon: 'calendar',
    version: '1.0.0',
  },
  DashboardView: GoogleCalendarDashboardView,
  EditView: GoogleCalendarEditView,
  IconComponent: Calendar,
};

