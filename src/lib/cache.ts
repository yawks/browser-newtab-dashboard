/**
 * Generic cache utility for plugins
 * Stores cached data in chrome.storage.local or localStorage
 */

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

const CACHE_PREFIX = 'plugin_cache_';

/**
 * Generate cache key for a specific frame instance
 */
function getCacheKey(frameId: string): string {
  return `${CACHE_PREFIX}${frameId}`;
}

/**
 * Load cached data from storage
 * @param frameId - Unique frame identifier
 * @param cacheDuration - Cache duration in seconds (0 = disabled)
 * @returns Cached data if valid, null otherwise
 */
export async function loadFromCache<T>(
  frameId: string,
  cacheDuration: number
): Promise<T | null> {
  // Cache disabled
  if (cacheDuration <= 0) {
    return null;
  }

  return new Promise((resolve) => {
    const cacheKey = getCacheKey(frameId);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([cacheKey], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Cache] Failed to load from chrome.storage:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }

        const cached = result[cacheKey];
        if (!cached) {
          resolve(null);
          return;
        }

        try {
          const parsedData: CachedData<T> = typeof cached === 'string' ? JSON.parse(cached) : cached;
          const now = Date.now();
          const age = (now - parsedData.timestamp) / 1000; // age in seconds

          // Check if cache is still valid
          if (age < cacheDuration) {
            resolve(parsedData.data);
          } else {
            // Cache expired
            resolve(null);
          }
        } catch (e) {
          console.error('[Cache] Failed to parse cached data:', e);
          resolve(null);
        }
      });
    } else {
      // Fallback to localStorage
      try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) {
          resolve(null);
          return;
        }

        const parsedData: CachedData<T> = JSON.parse(cached);
        const now = Date.now();
        const age = (now - parsedData.timestamp) / 1000; // age in seconds

        if (age < cacheDuration) {
          resolve(parsedData.data);
        } else {
          // Cache expired
          resolve(null);
        }
      } catch (e) {
        console.error('[Cache] Failed to load from localStorage:', e);
        resolve(null);
      }
    }
  });
}

/**
 * Save data to cache
 * @param frameId - Unique frame identifier
 * @param data - Data to cache
 */
export async function saveToCache<T>(
  frameId: string,
  data: T
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cacheKey = getCacheKey(frameId);
    const cacheData: CachedData<T> = {
      data,
      timestamp: Date.now(),
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [cacheKey]: JSON.stringify(cacheData) }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Cache] Failed to save to chrome.storage:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    } else {
      // Fallback to localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        resolve();
      } catch (e) {
        console.error('[Cache] Failed to save to localStorage:', e);
        reject(e);
      }
    }
  });
}

/**
 * Clear cache for a specific frame
 * @param frameId - Unique frame identifier
 */
export async function clearCache(frameId: string): Promise<void> {
  return new Promise((resolve) => {
    const cacheKey = getCacheKey(frameId);

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // Use set with undefined to delete the key
      chrome.storage.local.set({ [cacheKey]: undefined }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Cache] Failed to clear from chrome.storage:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    } else {
      // Fallback to localStorage
      try {
        localStorage.removeItem(cacheKey);
        resolve();
      } catch (e) {
        console.error('[Cache] Failed to clear from localStorage:', e);
        resolve();
      }
    }
  });
}

/**
 * Clear all plugin caches (for cleanup)
 */
export async function clearAllPluginCaches(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        const keysToRemove = Object.keys(items).filter(key => key.startsWith(CACHE_PREFIX));
        if (keysToRemove.length > 0) {
          const clearObj: Record<string, undefined> = {};
          keysToRemove.forEach(key => {
            clearObj[key] = undefined;
          });
          chrome.storage.local.set(clearObj, () => {
            resolve();
          });
        } else {
          resolve();
        }
      });
    } else {
      // Fallback to localStorage
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        resolve();
      } catch (e) {
        console.error('[Cache] Failed to clear all caches from localStorage:', e);
        resolve();
      }
    }
  });
}
