import { SunTimes } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

interface CachedSunTimes {
  sunrise: string;
  sunset: string;
  date: string; // YYYY-MM-DD format
  latitude: number;
  longitude: number;
}

/**
 * Fetch sunrise and sunset times for a given location
 * Uses the free sunrise-sunset.org API (no API key required)
 * Caches results using the generic cache system
 */
export async function fetchSunTimes(
  latitude: number,
  longitude: number,
  frameId?: string,
  cacheDuration?: number
): Promise<SunTimes> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

  // Check generic cache first if frameId is provided
  if (frameId && cacheDuration) {
    const cached = await loadFromCache<CachedSunTimes>(frameId, cacheDuration);
    if (cached && cached.date === dateStr && cached.latitude === latitude && cached.longitude === longitude) {
      return {
        sunrise: cached.sunrise,
        sunset: cached.sunset,
      };
    }
  }

  // API returns times in UTC, we'll convert them in the component
  const url = `https://api.sunrise-sunset.org/json?lat=${latitude}&lng=${longitude}&date=${dateStr}&formatted=0`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(data.status || 'Failed to fetch sun times');
    }

    const sunTimes: SunTimes = {
      sunrise: data.results.sunrise,
      sunset: data.results.sunset,
    };

    // Cache the result with generic cache if frameId is provided
    if (frameId) {
      try {
        const cacheData: CachedSunTimes = {
          sunrise: sunTimes.sunrise,
          sunset: sunTimes.sunset,
          date: dateStr,
          latitude,
          longitude,
        };
        await saveToCache(frameId, cacheData);
      } catch (cacheError) {
        // Don't fail if caching fails, just log it
        console.warn('[Sun Times Cache] Failed to cache sun times:', cacheError);
      }
    }

    return sunTimes;
  } catch (error) {
    console.error('Failed to fetch sun times:', error);
    throw error;
  }
}

/**
 * Get the system timezone
 */
export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Fallback for older browsers
    const offset = -new Date().getTimezoneOffset();
    const hours = Math.floor(Math.abs(offset) / 60);
    const minutes = Math.abs(offset) % 60;
    const sign = offset >= 0 ? '+' : '-';
    return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}

/**
 * Get timezone display name
 */
export function getTimezoneDisplayName(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'long',
    });
    const parts = formatter.formatToParts(new Date());
    const tzName = parts.find((part) => part.type === 'timeZoneName')?.value || timezone;
    return tzName;
  } catch {
    return timezone;
  }
}



