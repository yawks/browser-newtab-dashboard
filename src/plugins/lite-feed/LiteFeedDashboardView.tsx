import DOMPurify from 'dompurify';
import { AlertCircle, Loader2, Rss } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { LiteFeedConfig, LiteFeedEvent } from './types';
import { fetchLiteFeedEvents, markEventAsRead } from './api';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function getTypeColor(typeName: string): string {
  const colors = [
    'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
    'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
    'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
    'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30',
    'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30',
    'bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-500/30',
    'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < typeName.length; i++) {
    hash = (typeName.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function EventImage({ event, className, placeholder }: Readonly<{ event: LiteFeedEvent; className?: string; placeholder?: boolean }>) {
  if (event.image) {
    return (
      <img
        src={`data:image/svg+xml;base64,${event.image}`}
        alt={event.title}
        className={className}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = `data:image/png;base64,${event.image}`;
        }}
      />
    );
  }
  if (event.image_url) {
    return <img src={event.image_url} alt={event.title} className={className} />;
  }
  if (placeholder) {
    return (
      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded bg-muted text-muted-foreground">
        <Rss className="w-4 h-4" />
      </div>
    );
  }
  return null;
}

function SingleEventView({ event }: Readonly<{ event: LiteFeedEvent }>) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 flex flex-col gap-3 min-h-full">
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <EventImage event={event} className="w-8 h-8 object-contain" placeholder />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold truncate">{event.title}</h3>
              <span
                className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0"
                title={formatFullDate(event.pub_date)}
              >
                {formatRelativeTime(event.pub_date)}
              </span>
            </div>
            <div className="mt-0.5">
              <span className={`px-1.5 py-0.5 rounded text-xs border ${getTypeColor(event.type)}`}>
                {event.type}
              </span>
            </div>
          </div>
        </div>
        <div
          className="flex-1 flex items-center justify-center text-center text-sm prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }}
        />
      </div>
    </div>
  );
}

function EventListView({ events, config }: Readonly<{ events: LiteFeedEvent[]; config: LiteFeedConfig }>) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(events.filter(e => e.status === 'READ').map(e => e.id))
  );

  const handleToggle = async (event: LiteFeedEvent) => {
    const isExpanded = expandedId === event.id;
    setExpandedId(isExpanded ? null : event.id);

    if (!isExpanded && !readIds.has(event.id)) {
      setReadIds(prev => new Set(prev).add(event.id));
      try {
        await markEventAsRead(config, event.id);
      } catch {
        // silently ignore — local state already updated
      }
    }
  };

  return (
    <div className="p-2 overflow-y-auto">
      {events.map((event, index) => {
        const isExpanded = expandedId === event.id;
        const isRead = readIds.has(event.id);
        return (
          <div key={event.id}>
            {index > 0 && <div className="border-t border-border my-1" />}
            <button
              type="button"
              className="py-2 flex items-center gap-2 w-full text-left hover:bg-accent/40 rounded transition-colors"
              onClick={() => handleToggle(event)}
            >
              <div className="relative flex-shrink-0">
                <EventImage
                  event={event}
                  className="w-8 h-8 object-contain"
                  placeholder
                />
                {!isRead && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${isRead ? 'text-muted-foreground font-normal' : 'font-semibold'}`}>
                    {event.title}
                  </p>
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0"
                    title={formatFullDate(event.pub_date)}
                  >
                    {formatRelativeTime(event.pub_date)}
                  </span>
                </div>
                <div className="mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs border ${getTypeColor(event.type)}`}>
                    {event.type}
                  </span>
                </div>
              </div>
            </button>
            {isExpanded && (
              <div
                className="mx-2 mb-2 p-3 rounded-md bg-muted/50 border border-border text-sm prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LiteFeedDashboardView({ config, frameId }: PluginComponentProps) {
  const liteFeedConfig = (config as unknown as LiteFeedConfig) || {
    serverUrl: '',
    apiKey: '',
    maxResults: 10,
    cacheDuration: 3600,
  };

  const [events, setEvents] = useState<LiteFeedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async (forceRefresh: boolean = false) => {
    if (!liteFeedConfig.serverUrl || !liteFeedConfig.apiKey) {
      setError('Configuration incomplete. Please configure the widget in edit mode.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const cacheDuration = liteFeedConfig.cacheDuration ?? 3600;
      const fetched = await fetchLiteFeedEvents(liteFeedConfig, forceRefresh, frameId, cacheDuration);
      setEvents(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(() => loadEvents(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [liteFeedConfig.serverUrl, liteFeedConfig.apiKey, liteFeedConfig.type, liteFeedConfig.excludeType, liteFeedConfig.maxResults]);

  const loadEventsRef = useRef(loadEvents);
  useEffect(() => {
    loadEventsRef.current = loadEvents;
  }, [loadEvents]);

  useEffect(() => {
    if (frameId) {
      (globalThis as any)[`__pluginRefresh_${frameId}`] = () => loadEventsRef.current(true);
      return () => {
        delete (globalThis as any)[`__pluginRefresh_${frameId}`];
      };
    }
  }, [frameId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-4 text-muted-foreground">
        <p className="text-sm">No events found</p>
      </div>
    );
  }

  if (liteFeedConfig.maxResults === 1) {
    return <SingleEventView event={events[0]} />;
  }

  return <EventListView events={events} config={liteFeedConfig} />;
}
