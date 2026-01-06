import { NextcloudBookmark, NextcloudCollection, NextcloudTag } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

async function handleResponse(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

function buildHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchCollections(baseUrl: string, token?: string): Promise<NextcloudCollection[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/collections`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  return handleResponse(res);
}

export async function fetchTags(baseUrl: string, token?: string): Promise<NextcloudTag[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/tags`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  return handleResponse(res);
}

export async function fetchBookmarks(
  baseUrl: string,
  token: string | undefined,
  collectionId: string,
  tagIds: string[] | undefined,
  forceRefresh: boolean = false,
  frameId?: string,
  cacheDuration?: number
): Promise<NextcloudBookmark[]> {
  // Try to load from cache first
  if (!forceRefresh && frameId && cacheDuration) {
    const cached = await loadFromCache<NextcloudBookmark[]>(frameId, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  // Fetch from API
  const parts: string[] = [];
  if (collectionId) parts.push(`collectionId=${encodeURIComponent(collectionId)}`);
  if (tagIds && tagIds.length) parts.push(`tags=${encodeURIComponent(tagIds.join(','))}`);
  const query = parts.length ? `?${parts.join('&')}` : '';
  const url = `${baseUrl.replace(/\/+$/, '')}/bookmarks${query}`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  const bookmarks = await handleResponse(res);

  // Save to cache if frameId is provided
  if (frameId) {
    await saveToCache(frameId, bookmarks);
  }

  return bookmarks;
}

export async function validateCredentials(baseUrl: string, token?: string) {
  // Try fetching collections and tags as a basic validation
  await Promise.all([fetchCollections(baseUrl, token), fetchTags(baseUrl, token)]);
  return true;
}
