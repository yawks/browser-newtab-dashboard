import { Rss } from 'lucide-react';
import { Plugin } from '@/types/plugin';
import { LiteFeedDashboardView } from './LiteFeedDashboardView';
import { LiteFeedEditView } from './LiteFeedEditView';

export const LiteFeedPlugin: Plugin = {
  metadata: {
    id: 'lite-feed',
    name: 'Lite Feed',
    description: 'Display events from a lite-feed-server instance',
    icon: 'lite-feed',
    version: '1.0.0',
  },
  DashboardView: LiteFeedDashboardView,
  EditView: LiteFeedEditView,
  IconComponent: Rss,
};
