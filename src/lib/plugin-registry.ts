import { Plugin, PluginMetadata } from '@/types/plugin';

import { BookmarksPlugin } from '@/plugins/bookmarks/BookmarksPlugin';
import { NextcloudBookmarksPlugin } from '@/plugins/nextcloud-bookmarks/NextcloudBookmarksPlugin';
import { ClockPlugin } from '@/plugins/clock/ClockPlugin';
import { FinancePlugin } from '@/plugins/finance/FinancePlugin';
import { GoogleCalendarPlugin } from '@/plugins/googlecalendar/GoogleCalendarPlugin';
import { MeteoPlugin } from '@/plugins/meteo/MeteoPlugin';
import { TasktrovePlugin } from '@/plugins/tasktrove/TasktrovePlugin';
import { YoutrackPlugin } from '@/plugins/youtrack/YoutrackPlugin';

class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  constructor() {
    this.registerPlugin(BookmarksPlugin);
    this.registerPlugin(NextcloudBookmarksPlugin);
    this.registerPlugin(YoutrackPlugin);
    this.registerPlugin(TasktrovePlugin);
    this.registerPlugin(MeteoPlugin);
    this.registerPlugin(FinancePlugin);
    this.registerPlugin(GoogleCalendarPlugin);
    this.registerPlugin(ClockPlugin);
  }

  registerPlugin(plugin: Plugin): void {
    this.plugins.set(plugin.metadata.id, plugin);
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPluginMetadata(id: string): PluginMetadata | undefined {
    return this.plugins.get(id)?.metadata;
  }
}

export const pluginRegistry = new PluginRegistry();

