import { Bookmark } from 'lucide-react';
import { NextcloudDashboardView } from './NextcloudDashboardView';
import { NextcloudEditView } from './NextcloudEditView';
import { Plugin } from '@/types/plugin';

export const NextcloudBookmarksPlugin: Plugin = {
  metadata: {
    id: 'nextcloud-bookmarks',
    name: 'Nextcloud Bookmarks',
    description: 'Connect to a Nextcloud bookmarks manager and display bookmarks',
    icon: 'bookmark',
    version: '0.1.0',
  },
  DashboardView: NextcloudDashboardView,
  EditView: NextcloudEditView,
  IconComponent: Bookmark,
};
