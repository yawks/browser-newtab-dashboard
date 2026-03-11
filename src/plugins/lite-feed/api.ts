import { LiteFeedConfig, LiteFeedEvent } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

const REQUEST_TIMEOUT_MS = 30000;

export async function fetchLiteFeedEvents(
  config: LiteFeedConfig,
  forceRefresh: boolean = false,
  frameId?: string,
  cacheDuration?: number
): Promise<LiteFeedEvent[]> {
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<LiteFeedEvent[]>(frameId, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  const params = new URLSearchParams();
  params.append('max', config.maxResults.toString());
  config.status?.trim() && params.append('status', config.status.trim());
  config.type?.trim() && params.append('type', config.type.trim());
  // exclude_type supports multiple values by repeating the parameter
  if (config.excludeType?.trim()) {
    for (const t of config.excludeType.split(',')) {
      const trimmed = t.trim();
      if (trimmed) params.append('exclude_type', trimmed);
    }
  }

  const url = `${config.serverUrl.replace(/\/$/, '')}/get-events?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format: expected an array of events');
  }

  const events: LiteFeedEvent[] = data;

  if (frameId) {
    await saveToCache(frameId, events);
  }

  return events;
}

export async function markEventAsRead(config: LiteFeedConfig, eventId: string): Promise<void> {
  const url = `${config.serverUrl.replace(/\/$/, '')}/update-event/${eventId}`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'X-API-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'READ' }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
}
