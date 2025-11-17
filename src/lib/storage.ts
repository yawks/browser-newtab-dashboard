export interface DashboardData {
  frames: FrameData[];
}

export interface FrameData {
  id: string;
  pluginId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
  name?: string;
  isNsfw?: boolean;
}

const STORAGE_KEY = 'dashboard_data';
const THEME_KEY = 'dashboard_theme';

export type Theme = 'light' | 'dark';

export async function loadTheme(): Promise<Theme> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([THEME_KEY], (result) => {
        resolve((result[THEME_KEY] as Theme) || 'light');
      });
    } else {
      const theme = localStorage.getItem(THEME_KEY);
      resolve((theme as Theme) || 'light');
    }
  });
}

export async function saveTheme(theme: Theme): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [THEME_KEY]: theme }, () => {
        resolve();
      });
    } else {
      try {
        localStorage.setItem(THEME_KEY, theme);
        resolve();
      } catch (e) {
        console.error('Failed to save theme:', e);
        resolve();
      }
    }
  });
}

export async function loadDashboardData(): Promise<DashboardData> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        console.log('loadDashboardData - chrome.storage result:', result);
        const data = result[STORAGE_KEY];
        if (data) {
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            console.log('loadDashboardData - parsed data:', parsed);
            console.log('loadDashboardData - frames:', parsed.frames);
            if (parsed.frames) {
              parsed.frames.forEach((frame: FrameData) => {
                console.log('loadDashboardData - frame:', frame.id, 'pluginId:', frame.pluginId, 'config:', frame.config);
              });
            }
            resolve(parsed);
          } catch (e) {
            console.error('loadDashboardData - parse error:', e);
            resolve({ frames: [] });
          }
        } else {
          console.log('loadDashboardData - no data found');
          resolve({ frames: [] });
        }
      });
    } else {
      const data = localStorage.getItem(STORAGE_KEY);
      console.log('loadDashboardData - localStorage data:', data);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          console.log('loadDashboardData - parsed data:', parsed);
          resolve(parsed);
        } catch (e) {
          console.error('loadDashboardData - parse error:', e);
          resolve({ frames: [] });
        }
      } else {
        console.log('loadDashboardData - no data found');
        resolve({ frames: [] });
      }
    }
  });
}

export async function saveDashboardData(data: DashboardData): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(data) }, () => {
        resolve();
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        resolve();
      } catch (e) {
        console.error('Failed to save data:', e);
        resolve();
      }
    }
  });
}

