export interface SpaceData {
  id: string;
  name: string;
  frames: FrameData[];
}

export interface DashboardData {
  spaces: SpaceData[];
  activeSpaceId: string;
  frames?: FrameData[]; // Legacy support for migration
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
            
            // Migration: convert old format to new format
            if (parsed.frames && !parsed.spaces) {
              const defaultSpace: SpaceData = {
                id: 'default-space',
                name: 'Default',
                frames: parsed.frames || [],
              };
              const migrated: DashboardData = {
                spaces: [defaultSpace],
                activeSpaceId: 'default-space',
              };
              console.log('loadDashboardData - migrated to spaces format');
              resolve(migrated);
              return;
            }
            
            // Ensure we have at least one space
            if (!parsed.spaces || parsed.spaces.length === 0) {
              const defaultSpace: SpaceData = {
                id: 'default-space',
                name: 'Default',
                frames: [],
              };
              resolve({
                spaces: [defaultSpace],
                activeSpaceId: 'default-space',
              });
              return;
            }
            
            // Ensure activeSpaceId exists
            if (!parsed.activeSpaceId || !parsed.spaces.find((s: SpaceData) => s.id === parsed.activeSpaceId)) {
              parsed.activeSpaceId = parsed.spaces[0].id;
            }
            
            resolve(parsed);
          } catch (e) {
            console.error('loadDashboardData - parse error:', e);
            const defaultSpace: SpaceData = {
              id: 'default-space',
              name: 'Default',
              frames: [],
            };
            resolve({
              spaces: [defaultSpace],
              activeSpaceId: 'default-space',
            });
          }
        } else {
          console.log('loadDashboardData - no data found');
          const defaultSpace: SpaceData = {
            id: 'default-space',
            name: 'Default',
            frames: [],
          };
          resolve({
            spaces: [defaultSpace],
            activeSpaceId: 'default-space',
          });
        }
      });
    } else {
      const data = localStorage.getItem(STORAGE_KEY);
      console.log('loadDashboardData - localStorage data:', data);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          console.log('loadDashboardData - parsed data:', parsed);
          
          // Migration: convert old format to new format
          if (parsed.frames && !parsed.spaces) {
            const defaultSpace: SpaceData = {
              id: 'default-space',
              name: 'Default',
              frames: parsed.frames || [],
            };
            const migrated: DashboardData = {
              spaces: [defaultSpace],
              activeSpaceId: 'default-space',
            };
            console.log('loadDashboardData - migrated to spaces format');
            resolve(migrated);
            return;
          }
          
          // Ensure we have at least one space
          if (!parsed.spaces || parsed.spaces.length === 0) {
            const defaultSpace: SpaceData = {
              id: 'default-space',
              name: 'Default',
              frames: [],
            };
            resolve({
              spaces: [defaultSpace],
              activeSpaceId: 'default-space',
            });
            return;
          }
          
          // Ensure activeSpaceId exists
          if (!parsed.activeSpaceId || !parsed.spaces.find((s: SpaceData) => s.id === parsed.activeSpaceId)) {
            parsed.activeSpaceId = parsed.spaces[0].id;
          }
          
          resolve(parsed);
        } catch (e) {
          console.error('loadDashboardData - parse error:', e);
          const defaultSpace: SpaceData = {
            id: 'default-space',
            name: 'Default',
            frames: [],
          };
          resolve({
            spaces: [defaultSpace],
            activeSpaceId: 'default-space',
          });
        }
      } else {
        console.log('loadDashboardData - no data found');
        const defaultSpace: SpaceData = {
          id: 'default-space',
          name: 'Default',
          frames: [],
        };
        resolve({
          spaces: [defaultSpace],
          activeSpaceId: 'default-space',
        });
      }
    }
  });
}

export async function saveDashboardData(data: DashboardData): Promise<void> {
  return new Promise((resolve) => {
    // Clean up legacy frames property if it exists
    const cleanData = { ...data };
    if ('frames' in cleanData) {
      delete cleanData.frames;
    }
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(cleanData) }, () => {
        resolve();
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanData));
        resolve();
      } catch (e) {
        console.error('Failed to save data:', e);
        resolve();
      }
    }
  });
}

export async function saveSpaceFrames(spaceId: string, frames: FrameData[]): Promise<void> {
  return loadDashboardData().then((data) => {
    const space = data.spaces.find((s) => s.id === spaceId);
    if (space) {
      space.frames = frames;
      return saveDashboardData(data);
    }
  });
}

export async function createSpace(name: string): Promise<SpaceData> {
  return loadDashboardData().then((data) => {
    const newSpace: SpaceData = {
      id: `space-${Date.now()}`,
      name,
      frames: [],
    };
    data.spaces.push(newSpace);
    return saveDashboardData(data).then(() => newSpace);
  });
}

export async function deleteSpace(spaceId: string): Promise<void> {
  return loadDashboardData().then((data) => {
    if (data.spaces.length <= 1) {
      throw new Error('Cannot delete the last space');
    }
    data.spaces = data.spaces.filter((s) => s.id !== spaceId);
    if (data.activeSpaceId === spaceId) {
      data.activeSpaceId = data.spaces[0].id;
    }
    return saveDashboardData(data);
  });
}

export async function setActiveSpace(spaceId: string): Promise<void> {
  return loadDashboardData().then((data) => {
    if (data.spaces.find((s) => s.id === spaceId)) {
      data.activeSpaceId = spaceId;
      return saveDashboardData(data);
    }
  });
}

export async function renameSpace(spaceId: string, newName: string): Promise<void> {
  return loadDashboardData().then((data) => {
    const space = data.spaces.find((s) => s.id === spaceId);
    if (space) {
      space.name = newName.trim();
      return saveDashboardData(data);
    }
  });
}

