import { Plugin, PluginMetadata } from '@/types/plugin';

import { BookmarksPlugin } from '@/plugins/bookmarks/BookmarksPlugin';
import { NextcloudBookmarksPlugin } from '@/plugins/nextcloud-bookmarks/NextcloudBookmarksPlugin';
import { ClockPlugin } from '@/plugins/clock/ClockPlugin';
import { FinancePlugin } from '@/plugins/finance/FinancePlugin';
import { CalendarPlugin } from '@/plugins/calendar/CalendarPlugin';
import { MeteoPlugin } from '@/plugins/meteo/MeteoPlugin';
import { TasktrovePlugin } from '@/plugins/tasktrove/TasktrovePlugin';
import { VikunjaPlugin } from '@/plugins/vikunja/VikunjaPlugin';
import { TududiPlugin } from '@/plugins/tududi/TududiPlugin';
import { YoutrackPlugin } from '@/plugins/youtrack/YoutrackPlugin';
import { LiteFeedPlugin } from '@/plugins/lite-feed/LiteFeedPlugin';

class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  constructor() {
    this.registerPlugin(BookmarksPlugin);
    this.registerPlugin(NextcloudBookmarksPlugin);
    this.registerPlugin(YoutrackPlugin);
    this.registerPlugin(TasktrovePlugin);
    this.registerPlugin(VikunjaPlugin);
    this.registerPlugin(TududiPlugin);
    this.registerPlugin(MeteoPlugin);
    this.registerPlugin(FinancePlugin);
    this.registerPlugin(CalendarPlugin);
    this.registerPlugin(ClockPlugin);
    this.registerPlugin(LiteFeedPlugin);
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

