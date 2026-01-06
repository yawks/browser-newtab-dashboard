import {
  MeteoConfig,
  MeteoCitySuggestion,
  MeteoWeatherData,
  MeteoForecastDay,
  MeteoProvider,
} from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

const REQUEST_TIMEOUT = 30000;
const OPENWEATHER_BASE = 'https://api.openweathermap.org';

function withTimeout(signal?: AbortSignal) {
  return AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT) : signal;
}

export async function searchCities(
  provider: MeteoProvider,
  apiKey: string,
  query: string
): Promise<MeteoCitySuggestion[]> {
  if (!query.trim()) {
    return [];
  }

  switch (provider) {
    case 'openweather': {
      const url = `${OPENWEATHER_BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`;
      const response = await fetch(url, {
        signal: withTimeout(),
      });

      if (!response.ok) {
        throw new Error(`City search failed (${response.status})`);
      }

      const data = await response.json();
      return (data as any[]).map((item) => ({
        id: item.id,
        name: item.name,
        state: item.state,
        country: item.country,
        lat: item.lat,
        lon: item.lon,
      }));
    }
    default:
      return [];
  }
}

async function fetchOpenWeatherData(config: MeteoConfig): Promise<MeteoWeatherData> {
  if (!config.apiKey || !config.latitude || !config.longitude) {
    throw new Error('Missing API key or coordinates.');
  }

  const { apiKey, latitude, longitude } = config;
  const units = 'metric';

  const [currentRes, forecastRes] = await Promise.all([
    fetch(
      `${OPENWEATHER_BASE}/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=${units}&appid=${apiKey}`,
      { signal: withTimeout() }
    ),
    fetch(
      `${OPENWEATHER_BASE}/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=${units}&cnt=32&appid=${apiKey}`,
      { signal: withTimeout() }
    ),
  ]);

  if (!currentRes.ok) {
    throw new Error('Failed to fetch current weather.');
  }
  if (!forecastRes.ok) {
    throw new Error('Failed to fetch forecast.');
  }

  const currentData = await currentRes.json();
  const forecastData = await forecastRes.json();

  const current = {
    temperature: currentData.main.temp,
    minTemperature: currentData.main.temp_min,
    maxTemperature: currentData.main.temp_max,
    description: currentData.weather?.[0]?.description ?? '',
    icon: currentData.weather?.[0]?.icon ?? '01d',
    feelsLike: currentData.main.feels_like,
    humidity: currentData.main.humidity,
    windSpeed: currentData.wind.speed,
  };

  // Group forecast by day
  const dailyMap = new Map<string, { min: number; max: number; icon: string; description: string }>();
  for (const item of forecastData.list ?? []) {
    const date = new Date(item.dt_txt);
    date.setHours(0, 0, 0, 0);
    const key = date.toISOString();
    const min = item.main.temp_min;
    const max = item.main.temp_max;
    const icon = item.weather?.[0]?.icon ?? '01d';
    const description = item.weather?.[0]?.description ?? '';

    if (!dailyMap.has(key)) {
      dailyMap.set(key, { min, max, icon, description });
    } else {
      const entry = dailyMap.get(key)!;
      entry.min = Math.min(entry.min, min);
      entry.max = Math.max(entry.max, max);
      entry.icon = icon;
      entry.description = description;
    }
  }

  const forecast: MeteoForecastDay[] = Array.from(dailyMap.entries())
    .slice(0, 5)
    .map(([date, values]) => ({
      date,
      minTemperature: values.min,
      maxTemperature: values.max,
      icon: values.icon,
      description: values.description,
    }));

  return {
    current,
    forecast,
    provider: 'openweather',
    cityName: config.cityName || '',
    country: config.country,
  };
}

export async function fetchMeteoData(
  config: MeteoConfig,
  forceRefresh: boolean = false,
  frameId?: string,
  cacheDuration?: number
): Promise<MeteoWeatherData> {
  // Try to load from cache first
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<MeteoWeatherData>(frameId, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  let data: MeteoWeatherData;

  switch (config.provider) {
    case 'openweather':
    default:
      data = await fetchOpenWeatherData(config);
  }

  // Save to cache if frameId is provided
  if (frameId) {
    await saveToCache(frameId, data);
  }

  return data;
}

