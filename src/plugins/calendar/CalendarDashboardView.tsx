import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { CalendarConfig, CalendarEvent, migrateConfig } from './types';
import { getDaysForPeriod, getMonthGrid } from './utils';
import { useAutoScroll, useCalendarEvents } from './hooks';
import { useEffect, useRef, useState } from 'react';

import { DayColumn } from './DayColumn';
import { EventPopover } from './EventPopover';
import { PluginComponentProps } from '@/types/plugin';
import { Timeline } from './Timeline';
import { groupEventsByDay } from './api';

export function CalendarDashboardView({ config, debugEvents, frameId }: PluginComponentProps & { debugEvents?: CalendarEvent[] }) {
  const calendarConfig: CalendarConfig = migrateConfig(config as unknown as any);

  const hookResult = useCalendarEvents(calendarConfig, frameId);
  const events = debugEvents ?? hookResult.events;
  const isLoading = debugEvents ? false : hookResult.isLoading;
  const error = debugEvents ? null : hookResult.error;
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const eventRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (frameId) {
      (globalThis as any)[`__pluginRefresh_${frameId}`] = hookResult.refresh;
      return () => {
        delete (globalThis as any)[`__pluginRefresh_${frameId}`];
      };
    }
  }, [frameId, hookResult.refresh]);

  useAutoScroll(isLoading, containerRef);

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

  const handleEventClick = (event: CalendarEvent, buttonElement: HTMLButtonElement) => {
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
      setPopoverPosition(null);
      return;
    }

    setSelectedEvent(event);

    const rect = buttonElement.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverMaxHeight = window.innerHeight * 0.8;
    const spacing = 8;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 10) {
      left = rect.right - popoverWidth;
    }
    left = Math.max(10, left);

    let top = rect.bottom + spacing;
    if (top + popoverMaxHeight > window.innerHeight - 10) {
      top = rect.top - popoverMaxHeight - spacing;
      if (top < 10) {
        top = Math.max(10, (window.innerHeight - popoverMaxHeight) / 2);
      }
    }

    setPopoverPosition({ top, left });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let canGoPrev = true;
  let canGoNext = true;

  if (calendarConfig.period === 'month') {
    const minDate = new Date(today);
    minDate.setMonth(minDate.getMonth() - 3);
    minDate.setDate(1);

    const maxDate = new Date(today);
    maxDate.setMonth(maxDate.getMonth() + 3);
    maxDate.setDate(1);

    const currentMonth = new Date(currentDate);
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    canGoPrev = currentMonth.getTime() > minDate.getTime();
    canGoNext = currentMonth.getTime() < maxDate.getTime();
  } else {
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 14);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 14);

    const currentDay = new Date(currentDate);
    currentDay.setHours(0, 0, 0, 0);

    canGoPrev = currentDay.getTime() > minDate.getTime();
    canGoNext = currentDay.getTime() < maxDate.getTime();
  }

  const handlePrev = () => {
    if (!canGoPrev) return;
    const newDate = new Date(currentDate);
    if (calendarConfig.period === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    if (!canGoNext) return;
    const newDate = new Date(currentDate);
    if (calendarConfig.period === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  useEffect(() => {
    if (!containerRef.current || isLoading) return;

    const scrollToCurrentTime = () => {
      if (!containerRef.current) return;

      const now = new Date();
      if (currentDate.getDate() !== now.getDate() || currentDate.getMonth() !== now.getMonth()) {
        return;
      }

      const currentHour = now.getHours() + now.getMinutes() / 60;
      const hourHeight = 60;
      const marginTop = 30;
      const timelineTop = timelineRef.current ? timelineRef.current.offsetTop : 0;
      const targetScrollTop = timelineTop + currentHour * hourHeight - marginTop;

      containerRef.current.scrollTo({
        top: Math.max(0, Math.min(targetScrollTop, containerRef.current.scrollHeight - containerRef.current.clientHeight)),
        behavior: 'auto',
      });
    };

    scrollToCurrentTime();
    const timeoutId = setTimeout(scrollToCurrentTime, 0);
    const timeoutId2 = setTimeout(scrollToCurrentTime, 400);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
    };
  }, [isLoading, events.length, calendarConfig.period, currentDate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = calendarConfig.sources && calendarConfig.sources.length > 0;

  if (error || !isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center text-sm text-muted-foreground">
        <AlertCircle className="w-6 h-6 text-destructive mb-2" />
        <p>{error || 'Calendar not configured.'}</p>
      </div>
    );
  }

  // Collect all userEmails from sources for RSVP detection
  const userEmails = calendarConfig.sources
    .map((s) => s.userEmail)
    .filter(Boolean) as string[];
  const userEmail = userEmails[0];

  const days = getDaysForPeriod(calendarConfig.period, currentDate);
  const eventsByDay = groupEventsByDay(events);
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <>
      <div ref={containerRef} className="h-full overflow-y-auto">
        <div className="h-full p-2 box-border">
          {/* Month view */}
          {calendarConfig.period === 'month' ? (() => {
            const weeks = getMonthGrid(currentDate, calendarConfig.weekStart === 'monday');

            const weekdayLabels = (() => {
              const labels: string[] = [];
              for (let i = 0; i < 7; i++) {
                const dayIndex = calendarConfig.weekStart === 'monday' ? (i + 1) % 7 : i;
                const d = new Date(2020, 0, 5 + dayIndex);
                labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
              }
              return labels;
            })();

            const todayDate = new Date();
            const currentYear = todayDate.getFullYear();
            const currentMonth = String(todayDate.getMonth() + 1).padStart(2, '0');
            const currentDateStr = String(todayDate.getDate()).padStart(2, '0');
            const todayKey = `${currentYear}-${currentMonth}-${currentDateStr}`;

            return (
              <div className="w-full">
                <div className="text-center mb-2 text-xl font-bold px-1 flex items-center justify-center gap-2">
                  {canGoPrev ? (
                    <button onClick={handlePrev} className="p-1 hover:bg-accent rounded-full text-muted-foreground transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  ) : <div className="w-6 h-6" />}
                  {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  {canGoNext ? (
                    <button onClick={handleNext} className="p-1 hover:bg-accent rounded-full text-muted-foreground transition-colors"><ChevronRight className="w-4 h-4" /></button>
                  ) : <div className="w-6 h-6" />}
                </div>
                <div className="grid grid-cols-7 gap-2 mb-3 text-center">
                  {weekdayLabels.map((label, idx) => (
                    <div key={idx} className="text-sm font-semibold">{label}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {weeks.flat().map((day) => {
                    const year = day.getFullYear();
                    const month = String(day.getMonth() + 1).padStart(2, '0');
                    const date = String(day.getDate()).padStart(2, '0');
                    const dayKey = `${year}-${month}-${date}`;
                    const dayEvents = eventsByDay.get(dayKey) || [];
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isToday = dayKey === todayKey;

                    return (
                      <div key={dayKey} className={`min-h-[80px] border rounded p-2 bg-card ${isToday ? 'border-blue-500' : ''} ${isCurrentMonth ? '' : 'opacity-50'}`}>
                        <div className={`text-xs mb-2 ${isToday ? 'text-blue-500 font-bold' : 'text-muted-foreground'}`}>{date}</div>
                        <div className="space-y-1">
                          {dayEvents.map((event) => (
                            <button
                              key={event.id}
                              className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-accent bg-muted"
                              onClick={(e) => handleEventClick(event, e.currentTarget as HTMLButtonElement)}
                              ref={(el) => {
                                if (el) {
                                  eventRefs.current.set(event.id, el as HTMLButtonElement);
                                } else {
                                  eventRefs.current.delete(event.id);
                                }
                              }}
                            >
                              {event.summary || 'No title'}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })() : (
            /* Timeline and Events grid */
            <div className="grid gap-4 w-full box-border" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
              <div className="col-start-1 flex items-center justify-center gap-1">
                {canGoPrev ? (
                  <button onClick={handlePrev} className="p-1 hover:bg-accent rounded-full text-muted-foreground transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                ) : <div className="w-6 h-6" />}
                {canGoNext ? (
                  <button onClick={handleNext} className="p-1 hover:bg-accent rounded-full text-muted-foreground transition-colors"><ChevronRight className="w-4 h-4" /></button>
                ) : <div className="w-6 h-6" />}
              </div>
              {days.map((day) => (
                <div key={day.toISOString()} className="text-center font-semibold mb-2">
                  <div className="text-sm text-muted-foreground">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="text-xl">{day.getDate()}</div>
                </div>
              ))}

              <Timeline hours={hours} />

              {days.map((day) => {
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
                    userEmail={userEmail}
                    hours={hours}
                    onEventClick={handleEventClick}
                    eventRefs={eventRefs}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

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
