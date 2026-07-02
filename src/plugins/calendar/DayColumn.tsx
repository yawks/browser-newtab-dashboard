import { EventCard } from './EventCard';
import { CalendarEvent } from './types';
import { calculateEventLayout } from './utils';

interface DayColumnProps {
  dayKey: string;
  events: CalendarEvent[];
  userEmail?: string;
  hours: number[];
  onEventClick: (event: CalendarEvent, element: HTMLButtonElement) => void;
  eventRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

export function DayColumn({ dayKey, events, userEmail, hours, onEventClick, eventRefs }: DayColumnProps) {
  const timedEvents = events.filter(e => e.start.dateTime && e.end?.dateTime);
  const allDayEvents = events.filter(e => !e.start.dateTime || !e.end?.dateTime);
  const eventLayout = calculateEventLayout(timedEvents);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = dayKey === todayKey;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="relative min-w-0" style={{ height: `${24 * 60}px` }}>
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute border-t border-border/30"
          style={{ top: `${hour * 60}px`, left: 0, right: 0, height: '1px' }}
        />
      ))}

      {isToday && (
        <div
          className="absolute border-t-2 border-red-500 z-10"
          style={{ top: `${currentMinutes}px`, left: 0, right: 0 }}
        >
          <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
        </div>
      )}

      {allDayEvents.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          segment={null}
          isPrimary={true}
          userEmail={userEmail}
          onClick={onEventClick}
          eventRef={(el) => {
            if (el) eventRefs.current.set(event.id, el);
            else eventRefs.current.delete(event.id);
          }}
        />
      ))}

      {timedEvents.map((event) => {
        const segments = eventLayout.get(event.id) ?? [];
        return segments.map((segment, segIdx) => (
          <EventCard
            key={`${event.id}-seg${segIdx}`}
            event={event}
            segment={segment}
            isPrimary={segIdx === 0}
            userEmail={userEmail}
            onClick={onEventClick}
            eventRef={segIdx === 0
              ? (el) => {
                  if (el) eventRefs.current.set(event.id, el);
                  else eventRefs.current.delete(event.id);
                }
              : () => {}}
          />
        ));
      })}
    </div>
  );
}
