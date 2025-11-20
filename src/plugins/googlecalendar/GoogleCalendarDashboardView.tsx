import { AlertCircle, Loader2, Calendar, MapPin, Users, Clock, Link as LinkIcon, X } from 'lucide-react';
import { GoogleCalendarConfig, GoogleCalendarEvent } from './types';
import { useEffect, useRef, useState } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { fetchGoogleCalendarEvents, groupEventsByDay } from './api';

export function GoogleCalendarDashboardView({ config }: PluginComponentProps) {
  const googleCalendarConfig: GoogleCalendarConfig = {
    accessToken: (config as unknown as GoogleCalendarConfig)?.accessToken,
    selectedCalendarIds: (config as unknown as GoogleCalendarConfig)?.selectedCalendarIds || [],
    period: (config as unknown as GoogleCalendarConfig)?.period || '1-day',
  };

  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<GoogleCalendarEvent | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const eventRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadEvents = async () => {
      if (!googleCalendarConfig.accessToken || googleCalendarConfig.selectedCalendarIds.length === 0) {
        setError('Please configure the Google Calendar widget.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const fetchedEvents = await fetchGoogleCalendarEvents(googleCalendarConfig);
        setEvents(fetchedEvents);
      } catch (err) {
        console.error('Failed to fetch calendar events:', err);
        setError(err instanceof Error ? err.message : 'Failed to load events.');
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();

    // Refresh every 5 minutes
    const interval = setInterval(loadEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [
    googleCalendarConfig.accessToken,
    googleCalendarConfig.selectedCalendarIds?.join(',') || '',
    googleCalendarConfig.period,
  ]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!selectedEvent) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        event.target instanceof Node &&
        !popoverRef.current.contains(event.target) &&
        !Array.from(eventRefs.current.values()).some((ref) => ref.contains(event.target as Node))
      ) {
        setSelectedEvent(null);
        setPopoverPosition(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedEvent]);

  const handleEventClick = (event: GoogleCalendarEvent, buttonElement: HTMLButtonElement) => {
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
      setPopoverPosition(null);
      return;
    }

    setSelectedEvent(event);
    
    // Calculate popover position
    const rect = buttonElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    setPopoverPosition({
      top: rect.bottom + scrollTop + 8,
      left: rect.left + scrollLeft,
    });
  };

  const formatTime = (dateTime?: string, date?: string): string => {
    if (dateTime) {
      const d = new Date(dateTime);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (date) {
      return 'All day';
    }
    return '';
  };

  // Check if an event is in the past
  const isEventPast = (event: GoogleCalendarEvent): boolean => {
    const now = new Date();
    const eventEnd = event.end?.dateTime || event.end?.date;
    if (!eventEnd) return false;
    
    const endDate = new Date(eventEnd);
    return endDate < now;
  };

  // Find the current or next event (excluding all-day events)
  const findCurrentEvent = (events: GoogleCalendarEvent[]): GoogleCalendarEvent | null => {
    const now = new Date();
    
    // Find the first event that hasn't ended yet (excluding all-day events)
    for (const event of events) {
      // Skip all-day events (they have date but no dateTime)
      if (event.start.date && !event.start.dateTime) {
        continue;
      }
      
      const eventEnd = event.end?.dateTime || event.end?.date;
      if (eventEnd) {
        const endDate = new Date(eventEnd);
        if (endDate >= now) {
          return event;
        }
      }
    }
    
    return null;
  };

  // Auto-scroll to current event after events are loaded
  useEffect(() => {
    if (events.length === 0 || !containerRef.current || isLoading) return;
    
    // Wait for DOM to update with event elements
    const scrollTimeout = setTimeout(() => {
      if (!containerRef.current) return;
      
      const currentEvent = findCurrentEvent(events);
      if (currentEvent && eventRefs.current.has(currentEvent.id)) {
        const eventElement = eventRefs.current.get(currentEvent.id);
        if (eventElement) {
          eventElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        // All events are past, scroll to bottom
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 300);
    
    return () => clearTimeout(scrollTimeout);
  }, [events, isLoading]);

  const formatDate = (dateString: string): string => {
    // dateString is in format YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate.getTime() === today.getTime()) {
      return "Today";
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (eventDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    }

    const formatted = date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    // Capitalize first letter
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const getDaysForPeriod = (): Date[] => {
    const days: Date[] = [];
    // Get today in local timezone
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let count = 1;
    switch (googleCalendarConfig.period) {
      case '1-day':
        count = 1;
        break;
      case '3-days':
        count = 3;
        break;
      case '5-days':
        count = 5;
        break;
      case 'week':
        count = 7;
        break;
    }

    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push(date);
    }

    return days;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !googleCalendarConfig.accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center text-sm text-muted-foreground">
        <AlertCircle className="w-6 h-6 text-destructive mb-2" />
        <p>{error || 'Google Calendar not configured.'}</p>
      </div>
    );
  }

  const days = getDaysForPeriod();
  const eventsByDay = groupEventsByDay(events);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <div className="h-full p-4 box-border">
        {/* Header with day labels for multi-day views */}
        {googleCalendarConfig.period !== '1-day' && (
          <div className="grid mb-4 gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
            {days.map((day) => {
              // Format date as YYYY-MM-DD in local timezone
              const year = day.getFullYear();
              const month = String(day.getMonth() + 1).padStart(2, '0');
              const date = String(day.getDate()).padStart(2, '0');
              const dayKey = `${year}-${month}-${date}`;
              const dayEvents = eventsByDay.get(dayKey) || [];
              return (
                <div key={dayKey} className="text-center">
                  <div className="text-sm font-semibold mb-1">
                    {formatDate(dayKey)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Events grid */}
        <div className="grid gap-4 w-full box-border" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day) => {
            // Format date as YYYY-MM-DD in local timezone
            const year = day.getFullYear();
            const month = String(day.getMonth() + 1).padStart(2, '0');
            const date = String(day.getDate()).padStart(2, '0');
            const dayKey = `${year}-${month}-${date}`;
            const dayEvents = eventsByDay.get(dayKey) || [];

            return (
              <div key={dayKey} className="space-y-2 min-w-0">
                {dayEvents.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No events
                  </div>
                ) : (
                  dayEvents.map((event) => {
                    const isPast = isEventPast(event);
                    return (
                      <button
                        key={event.id}
                        ref={(el) => {
                          if (el) {
                            eventRefs.current.set(event.id, el);
                          } else {
                            eventRefs.current.delete(event.id);
                          }
                        }}
                        onClick={(e) => handleEventClick(event, e.currentTarget)}
                        className={`w-full text-left p-2 rounded-md border border-border transition-colors box-border ${
                          isPast
                            ? 'bg-muted/50 text-muted-foreground opacity-60 hover:bg-muted/70'
                            : 'bg-card hover:bg-accent'
                        }`}
                      >
                        <div className="text-sm font-medium truncate">{event.summary || 'No title'}</div>
                        <div className={`text-xs mt-1 ${isPast ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                          {formatTime(event.start.dateTime, event.start.date)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event details popover */}
      {selectedEvent && popoverPosition && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-80 max-w-[90vw] rounded-lg border border-border bg-card shadow-xl p-4 space-y-3 max-h-[80vh] overflow-y-auto"
          style={{
            top: `${Math.min(popoverPosition.top, window.innerHeight - 100)}px`,
            left: `${Math.min(Math.max(popoverPosition.left, 10), window.innerWidth - 330)}px`,
          }}
        >
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold pr-4">{selectedEvent.summary || 'No title'}</h3>
            <button
              onClick={() => {
                setSelectedEvent(null);
                setPopoverPosition(null);
              }}
              className="text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Time */}
          <div className="flex items-start gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">
                {formatTime(selectedEvent.start.dateTime, selectedEvent.start.date)}
              </div>
              {selectedEvent.end && (
                <div className="text-muted-foreground text-xs">
                  until {formatTime(selectedEvent.end.dateTime, selectedEvent.end.date)}
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          {selectedEvent.location && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-muted-foreground">{selectedEvent.location}</div>
            </div>
          )}

          {/* Description */}
          {selectedEvent.description && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {selectedEvent.description}
            </div>
          )}

          {/* Organizer */}
          {selectedEvent.organizer && (
            <div className="flex items-start gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Organizer</div>
                <div className="font-medium">
                  {selectedEvent.organizer.displayName || selectedEvent.organizer.email}
                </div>
              </div>
            </div>
          )}

          {/* Attendees */}
          {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">
                  Attendees ({selectedEvent.attendees.length})
                </div>
                <div className="space-y-1">
                  {selectedEvent.attendees.slice(0, 5).map((attendee, idx) => (
                    <div key={idx} className="text-xs">
                      {attendee.displayName || attendee.email}
                      {attendee.responseStatus && (
                        <span className="text-muted-foreground ml-2">
                          ({attendee.responseStatus})
                        </span>
                      )}
                    </div>
                  ))}
                  {selectedEvent.attendees.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      +{selectedEvent.attendees.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Link to Google Calendar */}
          {selectedEvent.htmlLink && (
            <a
              href={selectedEvent.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Open in Google Calendar</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

