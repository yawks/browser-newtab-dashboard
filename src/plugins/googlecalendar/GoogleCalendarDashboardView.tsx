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



  // Convert URLs in text to clickable links and \n to <br/>


  // Calculate event position and height based on time




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
