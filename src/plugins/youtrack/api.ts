import { YoutrackConfig, YoutrackIssue } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

const REQUEST_TIMEOUT_SECS = 30000; // 30 seconds in milliseconds
const MAX_ISSUES = 20;

export async function fetchYoutrackIssues(
  config: YoutrackConfig,
  query?: string,
  forceRefresh: boolean = false,
  frameId?: string,
  cacheDuration?: number
): Promise<YoutrackIssue[]> {
  // Try to load from cache first
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<YoutrackIssue[]>(frameId, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  const params = new URLSearchParams({
    $top: MAX_ISSUES.toString(),
    fields: config.issueFields,
  });

  if (query && query.trim() !== '') {
    params.append('query', query);
  }

  const url = `${config.apiEndpoint}/issues?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': config.authorizationHeader,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_SECS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    if (errorData.error) {
      throw new Error(
        `${errorData.error}: ${errorData.error_description || ''}\n${errorData.error_developer_message || ''}`
      );
    }

    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Check if response contains an error (Youtrack can return error in body even with 200 status)
  if (data && typeof data === 'object' && 'error' in data) {
    const error = data as any;
    throw new Error(
      `${error.error}: ${error.error_description || ''}\n${error.error_developer_message || ''}`
    );
  }

  // Ensure we have an array
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format: expected an array of issues');
  }

  const issues: YoutrackIssue[] = data;

  // Sort by created date (oldest first)
  // Youtrack timestamps are in milliseconds
  const sortedIssues = issues.sort((a, b) => {
    const aCreated = a.created || 0;
    const bCreated = b.created || 0;
    return aCreated - bCreated;
  });

  // Save to cache if frameId is provided
  if (frameId) {
    await saveToCache(frameId, sortedIssues);
  }

  return sortedIssues;
}

