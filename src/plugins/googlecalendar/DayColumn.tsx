import { EventCard } from './EventCard';
import { GoogleCalendarEvent } from './types';
import { calculateEventLayout } from './utils';

interface DayColumnProps {
  dayKey: string;
  events: GoogleCalendarEvent[];
  userEmail?: string;
  hours: number[];
  onEventClick: (event: GoogleCalendarEvent, element: HTMLButtonElement) => void;
  eventRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

export function DayColumn({ dayKey, events, userEmail, hours, onEventClick, eventRefs }: DayColumnProps) {
  const eventLayout = calculateEventLayout(events);

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
      {events.map((event) => {
        const layout = eventLayout.get(event.id) || { left: 0, width: 100 };
        
        return (
          <EventCard
            key={event.id}
            event={event}
            layout={layout}
            userEmail={userEmail}
            onClick={onEventClick}
            eventRef={(el) => {
              if (el) {
                eventRefs.current.set(event.id, el);
              } else {
                eventRefs.current.delete(event.id);
              }
            }}
          />
        );
      })}
    </div>
  );
}
