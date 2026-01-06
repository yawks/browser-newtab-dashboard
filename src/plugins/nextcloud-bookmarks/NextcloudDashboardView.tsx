import { NextcloudBookmark, NextcloudConfig } from './types';
import { useEffect, useState } from 'react';

import { BookmarkCard } from './BookmarkCard';
import { PluginComponentProps } from '@/types/plugin';
import { fetchBookmarks } from './api';

export function NextcloudDashboardView({ config }: PluginComponentProps) {
  const nextConfig: NextcloudConfig = {
    baseUrl: (config as unknown as NextcloudConfig)?.baseUrl,
    token: (config as unknown as NextcloudConfig)?.token,
    collectionId: (config as unknown as NextcloudConfig)?.collectionId,
    selectedTagIds: (config as unknown as NextcloudConfig)?.selectedTagIds || [],
    displayType: (config as unknown as NextcloudConfig)?.displayType || 'card',
  };

  const [bookmarks, setBookmarks] = useState<NextcloudBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!nextConfig.baseUrl || !nextConfig.token || !nextConfig.collectionId) return;
      setLoading(true);
      setError(null);
      try {
        const fetched = await fetchBookmarks(nextConfig.baseUrl, nextConfig.token, nextConfig.collectionId, nextConfig.selectedTagIds);
        setBookmarks(fetched);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load bookmarks';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [config?.baseUrl, config?.token, config?.collectionId, JSON.stringify(config?.selectedTagIds)]);

  if (!nextConfig.baseUrl || !nextConfig.token || !nextConfig.collectionId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        <p>Please configure the Nextcloud bookmarks widget (click the gear icon).</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">Loading bookmarks...</div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-4">{error}</div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">No bookmarks found.</div>
    );
  }

  if (nextConfig.displayType === 'compact') {
    return (
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 w-full">
        {bookmarks.map((b) => (
          <a
            key={b.id}
            href={b.url}
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-accent transition-colors group"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-card border border-border">
              {b.favicon ? (
                <img
                  src={b.favicon}
                  alt={b.title}
                  className={`w-7 h-7 object-contain ${b.favicon.endsWith('.svg') || b.favicon.includes('data:image/svg') ? 'icon-svg' : ''}`}
                />
              ) : (
                <div className="w-7 h-7 flex items-center justify-center text-lg">{b.title?.charAt(0)?.toUpperCase() || '?'}</div>
              )}
            </div>
            <span className="text-xs text-center w-full leading-tight line-clamp-2 break-words">{b.title}</span>
          </a>
        ))}
      </div>
    );
  }

  // card view
  return (
    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 w-full">
      {bookmarks.map((b) => (
        <BookmarkCard key={b.id} bookmark={b} />
      ))}
    </div>
  );
}
