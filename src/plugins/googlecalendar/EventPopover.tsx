import { Calendar, CheckCircle2, Circle, Clock, HelpCircle, Link as LinkIcon, MapPin, Users, X, XCircle } from 'lucide-react';
import { formatTime, getStatusIcon } from './utils';

import { GoogleCalendarEvent } from './types';
import { createPortal } from 'react-dom';

interface EventPopoverProps {
  event: GoogleCalendarEvent;
  position: { top: number; left: number };
  onClose: () => void;
  popoverRef: React.RefObject<HTMLDivElement>;
}

export function EventPopover({ event, position, onClose, popoverRef }: EventPopoverProps) {
  const getStatusIconComponent = (status?: string) => {
    const info = getStatusIcon(status);
    switch (info.icon) {
      case 'CheckCircle2':
        return CheckCircle2;
      case 'XCircle':
        return XCircle;
      case 'HelpCircle':
        return HelpCircle;
      default:
        return Circle;
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] w-80 max-w-[90vw] rounded-lg border border-border bg-card shadow-xl p-4 space-y-3 max-h-[80vh] overflow-y-auto"
      style={{
        top: `${Math.max(10, Math.min(position.top, window.innerHeight - 20))}px`,
        left: `${position.left}px`,
        maxHeight: `${Math.min(window.innerHeight - position.top - 20, window.innerHeight * 0.8)}px`,
      }}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold pr-4">{event.summary || 'No title'}</h3>
        <button
          onClick={onClose}
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
            {formatTime(event.start.dateTime, event.start.date)}
          </div>
          {event.end && (
            <div className="text-muted-foreground text-xs">
              until {formatTime(event.end.dateTime, event.end.date)}
            </div>
          )}
        </div>
      </div>

      {/* Location */}
      {event.location && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-muted-foreground">{event.location}</div>
        </div>
      )}

      {/* Description */}
      {event.description && (
        <div 
          className="text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ 
            __html: event.description
              .replace(/\\n/g, '\n')
              .replace(/\n/g, '<br/>')
          }}
        />
      )}

      {/* Separator before participants */}
      {(event.organizer || (event.attendees && event.attendees.length > 0)) && (
        <div className="border-t border-border pt-3 mt-3">
          {/* Organizer */}
          {event.organizer && (
            <div className="flex items-center gap-2 text-sm mb-2">
              <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-0.5">Organizer</div>
                <div className="font-medium">
                  {event.organizer.displayName || event.organizer.email}
                </div>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>Attendees ({event.attendees.length})</span>
              </div>
              <div className="space-y-1.5">
                {event.attendees.map((attendee, idx) => {
                  const statusInfo = getStatusIcon(attendee.responseStatus);
                  const StatusIcon = getStatusIconComponent(attendee.responseStatus);
                  const isOrganizer = event.organizer?.email === attendee.email;
                  
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
      {event.htmlLink && (
        <a
          href={event.htmlLink}
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
  );
}
