import { AlertCircle, Calendar, CheckCircle2, Circle, Clock, HelpCircle, Link as LinkIcon, Loader2, MapPin, Users, X, XCircle } from 'lucide-react';
import { GoogleCalendarConfig, GoogleCalendarEvent } from './types';
import { fetchGoogleCalendarEvents, groupEventsByDay } from './api';
import { useEffect, useRef, useState } from 'react';

import { PluginComponentProps } from '@/types/plugin';
import { createPortal } from 'react-dom';

export function GoogleCalendarDashboardView({ config }: PluginComponentProps) {
  const googleCalendarConfig: GoogleCalendarConfig = {
    authType: (config as unknown as GoogleCalendarConfig)?.authType,
    accessToken: (config as unknown as GoogleCalendarConfig)?.accessToken,
    selectedCalendarIds: (config as unknown as GoogleCalendarConfig)?.selectedCalendarIds || [],
    icalUrl: (config as unknown as GoogleCalendarConfig)?.icalUrl,
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
      const authType = googleCalendarConfig.authType || (googleCalendarConfig.accessToken ? 'oauth' : 'ical');
      
      // Validate configuration based on auth type
      if (authType === 'oauth') {
        if (!googleCalendarConfig.accessToken || !googleCalendarConfig.selectedCalendarIds || googleCalendarConfig.selectedCalendarIds.length === 0) {
          setError('Please configure the Google Calendar widget.');
          setIsLoading(false);
          return;
        }
      } else {
        if (!googleCalendarConfig.icalUrl) {
          setError('Please configure the iCal URL.');
          setIsLoading(false);
          return;
        }
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
    googleCalendarConfig.authType,
    googleCalendarConfig.accessToken,
    googleCalendarConfig.selectedCalendarIds?.join(',') || '',
    googleCalendarConfig.icalUrl,
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

  // Convert URLs in text to clickable links and \n to <br/>
  const renderTextWithLinks = (text: string): React.ReactNode => {
    if (!text) return text;
    
    // First, replace escaped \n with actual newlines
    // Handle both \\n (escaped) and \n (literal newline characters)
    let processedText = text.replace(/\\n/g, '\n');
    
    // Split by newlines (both \r\n and \n)
    const lines = processedText.split(/\r?\n/);
    const result: React.ReactNode[] = [];
    
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        result.push(<br key={`br-${lineIndex}`} />);
      }
      
      // Skip empty lines unless they're not the first or last
      if (line.trim() === '' && (lineIndex === 0 || lineIndex === lines.length - 1)) {
        return;
      }
      
      // URL regex pattern
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;

      while ((match = urlRegex.exec(line)) !== null) {
        // Add text before the URL
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        
        // Add the URL as a link
        const url = match[0];
        parts.push(
          <a
            key={`url-${lineIndex}-${match.index}`}
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
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      if (parts.length > 0) {
        result.push(<span key={`line-${lineIndex}`}>{parts}</span>);
      } else if (line.trim() === '') {
        // Preserve empty lines as spacing
        result.push(<span key={`empty-${lineIndex}`}>&nbsp;</span>);
      }
    });
    
    return result.length > 0 ? <>{result}</> : text;
  };

  // Get status icon and color for attendee response status
  const getStatusIcon = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'ACCEPTED':
        return { icon: CheckCircle2, color: 'text-green-500', label: 'Accepted' };
      case 'DECLINED':
        return { icon: XCircle, color: 'text-red-500', label: 'Declined' };
      case 'TENTATIVE':
        return { icon: HelpCircle, color: 'text-yellow-500', label: 'Tentative' };
      case 'NEEDS-ACTION':
      default:
        return { icon: Circle, color: 'text-gray-400', label: 'No response' };
    }
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
    const verticalSpacing = 4; // 4px spacing between consecutive events
    const top = startHour * hourHeight;
    const height = (endHour - startHour) * hourHeight - verticalSpacing; // Reduce height to create spacing
    
    return { top, height: Math.max(height, 30) }; // Minimum height of 30px
  };

  // Check if two events overlap
  const eventsOverlap = (event1: GoogleCalendarEvent, event2: GoogleCalendarEvent): boolean => {
    if (!event1.start.dateTime || !event1.end?.dateTime || !event2.start.dateTime || !event2.end?.dateTime) {
      return false;
    }
    
    const start1 = new Date(event1.start.dateTime).getTime();
    const end1 = new Date(event1.end.dateTime).getTime();
    const start2 = new Date(event2.start.dateTime).getTime();
    const end2 = new Date(event2.end.dateTime).getTime();
    
    return start1 < end2 && start2 < end1;
  };

  // Calculate layout for overlapping events (like Google Calendar)
  const calculateEventLayout = (events: GoogleCalendarEvent[]): Map<string, { left: number; width: number }> => {
    const layout = new Map<string, { left: number; width: number }>();
    
    if (events.length === 0) return layout;
        
    // Separate timed events from all-day events
    const timedEvents = events.filter(e => e.start.dateTime && e.end?.dateTime);
    
    if (timedEvents.length === 0) return layout;
    
    // Build overlap graph
    const overlaps: Map<string, Set<string>> = new Map();
    timedEvents.forEach(event => {
      overlaps.set(event.id, new Set());
    });
    
    for (let i = 0; i < timedEvents.length; i++) {
      for (let j = i + 1; j < timedEvents.length; j++) {
        if (eventsOverlap(timedEvents[i], timedEvents[j])) {
          overlaps.get(timedEvents[i].id)!.add(timedEvents[j].id);
          overlaps.get(timedEvents[j].id)!.add(timedEvents[i].id);
        }
      }
    }
    
    
    // Find connected components (groups of overlapping events)
    const visited = new Set<string>();
    const components: string[][] = [];
    
    const dfs = (eventId: string, component: string[]) => {
      if (visited.has(eventId)) return;
      visited.add(eventId);
      component.push(eventId);
      
      const neighbors = overlaps.get(eventId) || new Set();
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          dfs(neighborId, component);
        }
      });
    };
    
    timedEvents.forEach(event => {
      if (!visited.has(event.id)) {
        const component: string[] = [];
        dfs(event.id, component);
        if (component.length > 0) {
          components.push(component);
        }
      }
    });
    
    // For each component, calculate column assignments
    components.forEach(component => {
      // Sort events by start time
      const sortedEvents = component
        .map(id => timedEvents.find(e => e.id === id)!)
        .sort((a, b) => {
          const startA = new Date(a.start.dateTime!).getTime();
          const startB = new Date(b.start.dateTime!).getTime();
          return startA - startB;
        });
      
      // Assign columns using greedy algorithm
      const columns: Map<string, number> = new Map();
      const eventEnds: Map<number, number> = new Map(); // column -> end time
      
      sortedEvents.forEach(event => {
        const eventStartTime = new Date(event.start.dateTime!).getTime();
        const eventEndTime = new Date(event.end!.dateTime!).getTime();
        
        // Find the first available column (where previous event has ended)
        let column = 0;
        while (eventEnds.has(column) && eventEnds.get(column)! > eventStartTime) {
          column++;
        }
        
        columns.set(event.id, column);
        eventEnds.set(column, eventEndTime);
      });
      
      // Calculate maximum columns in this component
      const maxColumns = Math.max(...Array.from(columns.values())) + 1;
      
      // Calculate width and left position for each event with spacing
      // Use a fixed spacing percentage that's more visible
      const spacingPercent = 4; // 4% spacing between overlapping events
      const totalSpacingPercent = spacingPercent * (maxColumns - 1);
      const availableWidth = 100 - totalSpacingPercent;
      const eventWidth = availableWidth / maxColumns;
      
      sortedEvents.forEach(event => {
        const column = columns.get(event.id)!;
        // Calculate left position accounting for spacing
        // Formula: left = column * (eventWidth + spacingPercent)
        // This ensures each event is spaced by spacingPercent from the previous one
        const left = column * (eventWidth + spacingPercent);
        const width = eventWidth;
        
        layout.set(event.id, { left, width });
      });
      
    });
    
    // Events without overlaps get full width
    timedEvents.forEach(event => {
      if (!layout.has(event.id)) {
        layout.set(event.id, { left: 0, width: 100 });
      }
    });
    
    
    return layout;
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

  // Get user's response status for an event
  const getUserResponseStatus = (event: GoogleCalendarEvent): 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION' | null => {
    if (!event.attendees || event.attendees.length === 0) {
      return null;
    }

    // Strategy to find user's response status:
    // 1. PRIORITIZE TENTATIVE and DECLINED statuses (more specific, likely user's own response)
    // 2. If only one attendee has a status, that's likely the user
    // 3. Prefer non-organizer attendees with statuses
    // 4. Fallback to organizer if no other status found
    
    const organizerEmail = event.organizer?.email?.toLowerCase();
    
    // Find all attendees with a response status (excluding NEEDS-ACTION)
    const attendeesWithStatus = event.attendees.filter((attendee) => {
      const status = attendee.responseStatus?.toUpperCase();
      return status && status !== 'NEEDS-ACTION';
    });

    if (attendeesWithStatus.length === 0) {
      return null;
    }

    // PRIORITY 1: If there's only one attendee with a status, that's likely the user
    if (attendeesWithStatus.length === 1) {
      const status = attendeesWithStatus[0].responseStatus?.toUpperCase();
      if (status === 'ACCEPTED' || status === 'DECLINED' || status === 'TENTATIVE') {
        return status as 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
      }
    }

    // PRIORITY 2: Prioritize TENTATIVE and DECLINED (more specific statuses)
    // These are more likely to be the user's own response, especially if different from organizer
    const tentativeAttendee = attendeesWithStatus.find(
      (attendee) => attendee.responseStatus?.toUpperCase() === 'TENTATIVE'
    );
    if (tentativeAttendee) {
      return 'TENTATIVE';
    }

    const declinedAttendee = attendeesWithStatus.find(
      (attendee) => attendee.responseStatus?.toUpperCase() === 'DECLINED'
    );
    if (declinedAttendee) {
      return 'DECLINED';
    }

    // PRIORITY 3: If multiple attendees with status, prefer the one that's not the organizer
    const nonOrganizerAttendee = attendeesWithStatus.find(
      (attendee) => attendee.email?.toLowerCase() !== organizerEmail
    );

    if (nonOrganizerAttendee && nonOrganizerAttendee.responseStatus) {
      const status = nonOrganizerAttendee.responseStatus.toUpperCase();
      if (status === 'ACCEPTED' || status === 'DECLINED' || status === 'TENTATIVE') {
        return status as 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
      }
    }

    // PRIORITY 4: Check organizer if it's in attendees
    if (organizerEmail) {
      const organizerAttendee = event.attendees.find(
        (attendee) => attendee.email?.toLowerCase() === organizerEmail
      );
      
      if (organizerAttendee?.responseStatus) {
        const status = organizerAttendee.responseStatus.toUpperCase();
        if (status === 'ACCEPTED' || status === 'DECLINED' || status === 'TENTATIVE') {
          return status as 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
        }
      }
    }

    // Fallback: use the first attendee with a status
    if (attendeesWithStatus.length > 0 && attendeesWithStatus[0].responseStatus) {
      const status = attendeesWithStatus[0].responseStatus.toUpperCase();
      if (status === 'ACCEPTED' || status === 'DECLINED' || status === 'TENTATIVE') {
        return status as 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
      }
    }

    return null;
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
      
      const eventStart = event.start.dateTime ? new Date(event.start.dateTime) : null;
      const eventEnd = event.end?.dateTime || event.end?.date;
      
      if (eventStart && eventEnd) {
        const endDate = new Date(eventEnd);
        // Event is current or future if it hasn't ended yet
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
          
          // Scroll to position with margin (without animation)
          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'auto',
          });
        }
      } else {
        // All events are past, scroll to current time instead of bottom (without animation)
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        const hourHeight = 60; // Each hour = 60px
        const targetScrollTop = currentHour * hourHeight - 100; // 100px margin from top
        
        containerRef.current.scrollTo({
          top: Math.max(0, Math.min(targetScrollTop, containerRef.current.scrollHeight - containerRef.current.clientHeight)),
          behavior: 'auto',
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

  const authType = googleCalendarConfig.authType || (googleCalendarConfig.accessToken ? 'oauth' : 'ical');
  const isConfigured = authType === 'oauth' 
    ? (googleCalendarConfig.accessToken && googleCalendarConfig.selectedCalendarIds && googleCalendarConfig.selectedCalendarIds.length > 0)
    : !!googleCalendarConfig.icalUrl;

  if (error || !isConfigured) {
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
              const eventLayout = calculateEventLayout(dayEvents);

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
                    const isCancelled = event.status === 'CANCELLED';
                    const userResponseStatus = getUserResponseStatus(event);
                    const position = getEventPosition(event);
                    const layout = eventLayout.get(event.id) || { left: 0, width: 100 };
                    
                    // Determine background style based on user response
                    let textClass = '';
                    let backgroundStyle: React.CSSProperties = {};
                    
                    // Get CSS variable values for background colors
                    const getCSSVarValue = (varName: string): string => {
                      if (typeof window !== 'undefined' && document.documentElement) {
                        const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
                        return value || '';
                      }
                      return '';
                    };
                    
                    if (userResponseStatus === 'ACCEPTED') {
                      // Use accent color for accepted events to make them stand out
                      const accentColor = getCSSVarValue('--accent') || '210 40% 96.1%';
                      backgroundStyle = { 
                        backgroundColor: `hsl(${accentColor})`,
                      };
                    } else if (userResponseStatus === 'DECLINED') {
                      // Use muted color with transparency for declined events
                      const mutedColor = getCSSVarValue('--muted') || '210 40% 96.1%';
                      backgroundStyle = { 
                        backgroundColor: `hsl(${mutedColor} / 0.3)`,
                      };
                      textClass = 'line-through'; // Strikethrough text
                    } else if (userResponseStatus === 'TENTATIVE') {
                      // Use card color with a more visible hatch pattern for tentative events
                      const cardColor = getCSSVarValue('--card') || '0 0% 100%';
                      // Use a more visible pattern - check if dark mode
                      const isDark = document.documentElement.classList.contains('dark');
                      const hatchColor = isDark 
                        ? 'rgba(255, 255, 255, 0.2)' // White lines in dark mode
                        : 'rgba(0, 0, 0, 0.25)'; // Dark lines in light mode
                      backgroundStyle = {
                        backgroundColor: `hsl(${cardColor})`,
                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 4px, ${hatchColor} 4px, ${hatchColor} 8px)`,
                        backgroundSize: '12px 12px',
                      };
                    } else {
                      // Default or NEEDS-ACTION - use card color
                      if (isPast) {
                        const mutedColor = getCSSVarValue('--muted') || '210 40% 96.1%';
                        backgroundStyle = { 
                          backgroundColor: `hsl(${mutedColor} / 0.5)`,
                        };
                      } else {
                        const cardColor = getCSSVarValue('--card') || '0 0% 100%';
                        backgroundStyle = { 
                          backgroundColor: `hsl(${cardColor})`,
                        };
                      }
                    }
                    
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
                              ? 'text-muted-foreground opacity-60'
                              : ''
                          } ${textClass} ${isCancelled ? 'line-through opacity-50' : ''}`}
                          style={{
                            backgroundColor: backgroundStyle.backgroundColor,
                            backgroundImage: backgroundStyle.backgroundImage,
                            backgroundSize: backgroundStyle.backgroundSize,
                          }}
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
                            // Apply styles with !important to override any CSS
                            if (backgroundStyle.backgroundColor) {
                              el.style.setProperty('background-color', String(backgroundStyle.backgroundColor), 'important');
                            }
                            if (backgroundStyle.backgroundImage) {
                              el.style.setProperty('background-image', String(backgroundStyle.backgroundImage), 'important');
                            }
                            if (backgroundStyle.backgroundSize) {
                              el.style.setProperty('background-size', String(backgroundStyle.backgroundSize), 'important');
                            }
                          } else {
                            eventRefs.current.delete(event.id);
                          }
                        }}
                        onClick={(e) => handleEventClick(event, e.currentTarget)}
                        className={`absolute text-left p-1.5 rounded border border-border transition-colors overflow-hidden ${
                          isPast
                            ? 'text-muted-foreground opacity-60'
                            : ''
                        } ${textClass} ${isCancelled ? 'line-through opacity-50' : ''}`}
                        style={{
                          top: `${position.top}px`,
                          height: `${position.height}px`,
                          minHeight: '30px',
                          left: `${layout.left}%`,
                          width: `${layout.width}%`,
                          // Also apply in style prop as fallback
                          backgroundColor: backgroundStyle.backgroundColor,
                          backgroundImage: backgroundStyle.backgroundImage,
                          backgroundSize: backgroundStyle.backgroundSize,
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
            <div className="text-sm text-muted-foreground">
              {renderTextWithLinks(selectedEvent.description)}
            </div>
          )}

          {/* Separator before participants */}
          {(selectedEvent.organizer || (selectedEvent.attendees && selectedEvent.attendees.length > 0)) && (
            <div className="border-t border-border pt-3 mt-3">
              {/* Organizer */}
              {selectedEvent.organizer && (
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-0.5">Organizer</div>
                    <div className="font-medium">
                      {selectedEvent.organizer.displayName || selectedEvent.organizer.email}
                    </div>
                  </div>
                </div>
              )}

              {/* Attendees */}
              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>Attendees ({selectedEvent.attendees.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedEvent.attendees.map((attendee, idx) => {
                      const statusInfo = getStatusIcon(attendee.responseStatus);
                      const StatusIcon = statusInfo.icon;
                      const isOrganizer = selectedEvent.organizer?.email === attendee.email;
                      
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div title={statusInfo.label} className="flex-shrink-0">
                            <StatusIcon
                              className={`w-4 h-4 ${statusInfo.color}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`truncate ${isOrganizer ? 'font-medium text-blue-600' : ''}`}>
                              {attendee.displayName || attendee.email}
                              {isOrganizer && (
                                <span className="text-xs text-muted-foreground ml-1">(Organizer)</span>
                              )}
                            </div>
                            {attendee.email && attendee.displayName && (
                              <div className="text-xs text-muted-foreground truncate">
                                {attendee.email}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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

