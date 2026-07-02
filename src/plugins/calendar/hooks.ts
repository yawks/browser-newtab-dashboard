import { CalendarConfig, CalendarEvent } from './types';
import { useEffect, useState } from 'react';

import { fetchCalendarEvents } from './api';

export function useCalendarEvents(config: CalendarConfig, frameId?: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable dependency key derived from sources
  const sourcesKey = (config.sources || [])
    .map((s) => `${s.id}:${s.type}:${s.accessToken || ''}:${s.selectedCalendarIds?.join(',') || ''}:${s.icalUrl || ''}`)
    .join('|');

  useEffect(() => {
    const loadEvents = async (forceRefresh: boolean = false) => {
      if (!config.sources || config.sources.length === 0) {
        setError('Please configure the Calendar widget.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const fetchedEvents = await fetchCalendarEvents(config, forceRefresh, frameId);
        setEvents(fetchedEvents);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load events.';

        if (errorMessage.includes('Authentication expired') || errorMessage.includes('401')) {
          setError('Authentication expired. Please reconnect to Google Calendar in the settings.');
        } else {
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();

    // Refresh every 5 minutes
    const interval = setInterval(() => loadEvents(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sourcesKey, config.period, frameId]);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedEvents = await fetchCalendarEvents(config, true, frameId);
      setEvents(fetchedEvents);
    } catch (err) {
      console.error('Failed to refresh calendar events:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh events.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return { events, isLoading, error, refresh };
}

export function useAutoScroll(
  isLoading: boolean,
  containerRef: React.RefObject<HTMLDivElement>
) {
  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    const scrollTimeout = setTimeout(() => {
      if (!containerRef.current) return;

      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const hourHeight = 60;
      const marginTop = 0;

      const currentTimePosition = currentHour * hourHeight;
      const targetScrollTop = currentTimePosition - marginTop;

      const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
      const finalScrollTop = Math.max(0, Math.min(targetScrollTop, maxScroll));

      containerRef.current.scrollTo({
        top: finalScrollTop,
        behavior: 'auto',
      });
    }, 300);

    return () => clearTimeout(scrollTimeout);
  }, [isLoading, containerRef]);
}
