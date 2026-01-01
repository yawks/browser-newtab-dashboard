import { GoogleCalendarConfig, GoogleCalendarEvent } from './types';
import { useEffect, useState } from 'react';

import { fetchGoogleCalendarEvents } from './api';

/**
 * Custom hook to fetch and manage calendar events
 */
export function useCalendarEvents(config: GoogleCalendarConfig) {
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEvents = async (forceRefresh: boolean = false) => {
      const authType = config.authType || (config.accessToken ? 'oauth' : 'ical');
      
      // Validate configuration based on auth type
      if (authType === 'oauth') {
        if (!config.accessToken || !config.selectedCalendarIds || config.selectedCalendarIds.length === 0) {
          setError('Please configure the Google Calendar widget.');
          setIsLoading(false);
          return;
        }
      } else {
        if (!config.icalUrl) {
          setError('Please configure the iCal URL.');
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const fetchedEvents = await fetchGoogleCalendarEvents(config, forceRefresh);
        setEvents(fetchedEvents);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load events.';
        
        // If authentication expired, show a helpful message
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
  }, [
    config.authType,
    config.accessToken,
    config.selectedCalendarIds?.join(',') || '',
    config.icalUrl,
    config.period,
  ]);

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedEvents = await fetchGoogleCalendarEvents(config, true);
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

/**
 * Custom hook to auto-scroll to current time
 */
export function useAutoScroll(
  isLoading: boolean,
  containerRef: React.RefObject<HTMLDivElement>
) {
  useEffect(() => {
    // Don't scroll while loading or if container doesn't exist
    if (!containerRef.current || isLoading) return;
    
    // Wait for DOM to update
    const scrollTimeout = setTimeout(() => {
      if (!containerRef.current) return;
      
      // Always scroll to current time with precise positioning
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const hourHeight = 60; // Each hour = 60px
      const marginTop = 0;
      
      // Calculate position: current time position minus desired margin
      const currentTimePosition = currentHour * hourHeight;
      const targetScrollTop = currentTimePosition - marginTop;
      
      // Ensure scroll doesn't go negative or beyond content
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
