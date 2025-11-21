import { AlertCircle, Loader2, Calendar, MapPin, Users, Clock, Link as LinkIcon, X } from 'lucide-react';
import { createPortal } from 'react-dom';
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
    
    // Calculate popover position (using getBoundingClientRect for portal)
    const rect = buttonElement.getBoundingClientRect();
    const popoverWidth = 320; // w-80 = 320px
    const popoverMaxHeight = window.innerHeight * 0.8; // max-h-[80vh]
    const spacing = 8;
    
    // Calculate horizontal position
    let left = rect.left;
    // If popover would overflow on the right, align to the right of the button
    if (left + popoverWidth > window.innerWidth - 10) {
      left = rect.right - popoverWidth;
    }
    // Ensure it doesn't overflow on the left
    left = Math.max(10, left);
    
    // Calculate vertical position
    let top = rect.bottom + spacing;
    // If popover would overflow at the bottom, position it above the button
    if (top + popoverMaxHeight > window.innerHeight - 10) {
      top = rect.top - popoverMaxHeight - spacing;
      // If it would overflow at the top, center it vertically
      if (top < 10) {
        top = Math.max(10, (window.innerHeight - popoverMaxHeight) / 2);
      }
    }
    
    setPopoverPosition({
      top,
      left,
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

  // Convert URLs in text to clickable links
  const renderTextWithLinks = (text: string): React.ReactNode => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Add the URL as a link
      const url = match[0];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
      
      lastIndex = match.index + url.length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? <>{parts}</> : text;
  };

  // Calculate event position and height based on time
  const getEventPosition = (event: GoogleCalendarEvent): { top: number; height: number } | null => {
    if (!event.start.dateTime || !event.end?.dateTime) {
      return null; // All-day events or events without time
    }

    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);
    
    const startHour = startDate.getHours() + startDate.getMinutes() / 60;
    const endHour = endDate.getHours() + endDate.getMinutes() / 60;
    
    // Each hour = 60px (adjust as needed)
    const hourHeight = 60;
    const top = startHour * hourHeight;
    const height = (endHour - startHour) * hourHeight;
    
    return { top, height: Math.max(height, 30) }; // Minimum height of 30px
  };

  // Generate hours for timeline (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

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
          // Calculate scroll position with a small margin at the top
          const container = containerRef.current;
          const eventRect = eventElement.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const scrollTop = container.scrollTop;
          const marginTop = 20; // Small margin in pixels
          
          // Calculate the target scroll position
          const targetScrollTop = scrollTop + eventRect.top - containerRect.top - marginTop;
          
          // Scroll to position with margin
          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          });
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
    <>
      <div ref={containerRef} className="h-full overflow-y-auto">
        <div className="h-full p-4 box-border">
          {/* Header with day labels for multi-day views */}
          {googleCalendarConfig.period !== '1-day' && (
            <div className="grid mb-4 gap-2" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
              <div></div> {/* Spacer for timeline column */}
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

          {/* Timeline and Events grid */}
          <div className="grid gap-4 w-full box-border" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
            {/* Timeline column */}
            <div className="relative" style={{ height: `${24 * 60}px` }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute text-xs text-muted-foreground pr-2 text-right"
                  style={{
                    top: `${hour * 60}px`,
                    height: '60px',
                    width: '60px',
                  }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns with events */}
            {days.map((day) => {
              // Format date as YYYY-MM-DD in local timezone
              const year = day.getFullYear();
              const month = String(day.getMonth() + 1).padStart(2, '0');
              const date = String(day.getDate()).padStart(2, '0');
              const dayKey = `${year}-${month}-${date}`;
              const dayEvents = eventsByDay.get(dayKey) || [];

              return (
                <div key={dayKey} className="relative min-w-0" style={{ height: `${24 * 60}px` }}>
                  {/* Hour lines */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute border-t border-border/30"
                      style={{
                        top: `${hour * 60}px`,
                        left: 0,
                        right: 0,
                        height: '1px',
                      }}
                    />
                  ))}
                  
                  {/* Events positioned by time */}
                  {dayEvents.map((event) => {
                    const isPast = isEventPast(event);
                    const position = getEventPosition(event);
                    
                    // Handle all-day events
                    if (!position) {
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
                          className={`absolute top-0 left-0 right-0 text-left p-2 rounded-md border border-border transition-colors ${
                            isPast
                              ? 'bg-muted/50 text-muted-foreground opacity-60 hover:bg-muted/70'
                              : 'bg-card hover:bg-accent'
                          }`}
                        >
                          <div className="text-sm font-medium truncate">{event.summary || 'No title'}</div>
                          <div className="text-xs text-muted-foreground">All day</div>
                        </button>
                      );
                    }

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
                        className={`absolute left-0 right-0 text-left p-1.5 rounded border border-border transition-colors overflow-hidden ${
                          isPast
                            ? 'bg-muted/50 text-muted-foreground opacity-60 hover:bg-muted/70'
                            : 'bg-card hover:bg-accent'
                        }`}
                        style={{
                          top: `${position.top}px`,
                          height: `${position.height}px`,
                          minHeight: '30px',
                        }}
                      >
                        <div className="text-xs font-medium truncate">{event.summary || 'No title'}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTime(event.start.dateTime, event.start.date)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event details popover - using portal to escape overflow container */}
      {selectedEvent && popoverPosition && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-80 max-w-[90vw] rounded-lg border border-border bg-card shadow-xl p-4 space-y-3 max-h-[80vh] overflow-y-auto"
          style={{
            top: `${Math.max(10, Math.min(popoverPosition.top, window.innerHeight - 20))}px`,
            left: `${popoverPosition.left}px`,
            maxHeight: `${Math.min(window.innerHeight - popoverPosition.top - 20, window.innerHeight * 0.8)}px`,
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
              {renderTextWithLinks(selectedEvent.description)}
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
        </div>,
        document.body
      )}
    </>
  );
}

