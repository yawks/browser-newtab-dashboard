import { AlertCircle, Loader2 } from 'lucide-react';
import { GoogleCalendarConfig, GoogleCalendarEvent } from './types';
import { formatDate, getDaysForPeriod } from './utils';
import { useAutoScroll, useCalendarEvents } from './hooks';
import { useEffect, useRef, useState } from 'react';

import { DayColumn } from './DayColumn';
import { EventPopover } from './EventPopover';
import { PluginComponentProps } from '@/types/plugin';
import { Timeline } from './Timeline';
import { groupEventsByDay } from './api';

export function GoogleCalendarDashboardView({ config }: PluginComponentProps) {
  const googleCalendarConfig: GoogleCalendarConfig = {
    authType: (config as unknown as GoogleCalendarConfig)?.authType,
    accessToken: (config as unknown as GoogleCalendarConfig)?.accessToken,
    selectedCalendarIds: (config as unknown as GoogleCalendarConfig)?.selectedCalendarIds || [],
    icalUrl: (config as unknown as GoogleCalendarConfig)?.icalUrl,
    period: (config as unknown as GoogleCalendarConfig)?.period || '1-day',
    userEmail: (config as unknown as GoogleCalendarConfig)?.userEmail,
  };

  const { events, isLoading, error } = useCalendarEvents(googleCalendarConfig);
  const [selectedEvent, setSelectedEvent] = useState<GoogleCalendarEvent | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const eventRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  // Use auto-scroll hook
  useAutoScroll(isLoading, containerRef);

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

  // Check if an event is currently ongoing
  const isEventOngoing = (event: GoogleCalendarEvent): boolean => {
    if (!event.start.dateTime || !event.end?.dateTime) {
      return false; // All-day events or events without time cannot be "ongoing"
    }
    
    const now = new Date();
    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);
    
    return startDate <= now && now <= endDate;
  };

  // Get user's response status for an event
  const getUserResponseStatus = (event: GoogleCalendarEvent): 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION' | null => {
    if (!event.attendees || event.attendees.length === 0) {
      return null;
    }

    const userEmail = googleCalendarConfig.userEmail?.toLowerCase();
    
    // If user email is configured, find that specific attendee
    if (userEmail) {
      const userAttendee = event.attendees.find(
        (attendee) => attendee.email?.toLowerCase() === userEmail
      );
      if (userAttendee?.responseStatus) {
        const status = userAttendee.responseStatus.toUpperCase();
        if (status === 'ACCEPTED' || status === 'DECLINED' || status === 'TENTATIVE') {
          return status as 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
        }
      }
      // User email configured but not found in attendees or has NEEDS-ACTION
      return null;
    }

    // No user email configured - cannot determine user's status
    return null;
  };

  // Auto-scroll to current time after events are loaded
  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    const scrollToCurrentTime = () => {
      if (!containerRef.current) return;
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const hourHeight = 60; // Each hour = 60px
      const marginTop = 30; // Keep a small margin from the top
      const timelineTop = timelineRef.current ? timelineRef.current.offsetTop : 0;
      const targetScrollTop = timelineTop + currentHour * hourHeight - marginTop;


      containerRef.current.scrollTo({
        top: Math.max(0, Math.min(targetScrollTop, containerRef.current.scrollHeight - containerRef.current.clientHeight)),
        behavior: 'auto',
      });
    };

    // First attempt immediately after render
    scrollToCurrentTime();
    // Second attempt after DOM/layout settles
    const timeoutId = setTimeout(scrollToCurrentTime, 0);
    // Third attempt slightly later to override any layout jumps
    const timeoutId2 = setTimeout(scrollToCurrentTime, 400);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
    };
  }, [isLoading, events.length, googleCalendarConfig.period]);

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

  const days = getDaysForPeriod(googleCalendarConfig.period);
  const eventsByDay = groupEventsByDay(events);
  const hours = Array.from({ length: 24 }, (_, i) => i);

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
            <Timeline hours={hours} />

            {/* Day columns with events */}
            {days.map((day) => {
              // Format date as YYYY-MM-DD in local timezone
              const year = day.getFullYear();
              const month = String(day.getMonth() + 1).padStart(2, '0');
              const date = String(day.getDate()).padStart(2, '0');
              const dayKey = `${year}-${month}-${date}`;
              const dayEvents = eventsByDay.get(dayKey) || [];

              return (
                <DayColumn
                  key={dayKey}
                  dayKey={dayKey}
                  events={dayEvents}
                  userEmail={googleCalendarConfig.userEmail}
                  hours={hours}
                  onEventClick={handleEventClick}
                  eventRefs={eventRefs}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Event details popover */}
      {selectedEvent && popoverPosition && (
        <EventPopover
          event={selectedEvent}
          position={popoverPosition}
          onClose={() => {
            setSelectedEvent(null);
            setPopoverPosition(null);
          }}
          popoverRef={popoverRef}
        />
      )}
    </>
  );
}
