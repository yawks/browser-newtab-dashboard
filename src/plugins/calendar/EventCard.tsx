import { EventSegment, formatTime, getCSSVarValue, getUserResponseStatus, isEventPast } from './utils';

import { CalendarEvent } from './types';
import React from 'react';

interface EventCardProps {
  readonly event: CalendarEvent;
  readonly segment: EventSegment | null;
  readonly isPrimary: boolean;
  readonly userEmail?: string;
  readonly onClick: (event: CalendarEvent, element: HTMLButtonElement) => void;
  readonly eventRef: (el: HTMLButtonElement | null) => void;
}

export function EventCard({ event, segment, isPrimary, userEmail, onClick, eventRef }: EventCardProps) {
  const isPast = isEventPast(event);
  const isCancelled = event.status === 'CANCELLED';
  const userResponseStatus = getUserResponseStatus(event, userEmail);

  let textClass = '';
  const backgroundStyle: React.CSSProperties = {};

  if (userResponseStatus === 'ACCEPTED') {
    const accentColor = getCSSVarValue('--accent') || '210 40% 96.1%';
    backgroundStyle.backgroundColor = `hsl(${accentColor})`;
  } else if (userResponseStatus === 'DECLINED') {
    const mutedColor = getCSSVarValue('--muted') || '210 40% 96.1%';
    backgroundStyle.backgroundColor = `hsl(${mutedColor} / 0.3)`;
    textClass = 'line-through';
  } else if (userResponseStatus === 'TENTATIVE') {
    const cardColor = getCSSVarValue('--card') || '0 0% 100%';
    const isDark = document.documentElement.classList.contains('dark');
    const hatchColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.25)';
    backgroundStyle.backgroundColor = `hsl(${cardColor})`;
    backgroundStyle.backgroundImage = `repeating-linear-gradient(45deg, transparent, transparent 4px, ${hatchColor} 4px, ${hatchColor} 8px)`;
    backgroundStyle.backgroundSize = '12px 12px';
  } else {
    if (isPast) {
      const mutedColor = getCSSVarValue('--muted') || '210 40% 96.1%';
      backgroundStyle.backgroundColor = `hsl(${mutedColor} / 0.5)`;
    } else {
      const cardColor = getCSSVarValue('--card') || '0 0% 100%';
      backgroundStyle.backgroundColor = `hsl(${cardColor})`;
    }
  }

  const applyInlineStyles = (el: HTMLButtonElement) => {
    if (backgroundStyle.backgroundColor) el.style.setProperty('background-color', String(backgroundStyle.backgroundColor), 'important');
    if (backgroundStyle.backgroundImage) el.style.setProperty('background-image', String(backgroundStyle.backgroundImage), 'important');
    if (backgroundStyle.backgroundSize) el.style.setProperty('background-size', String(backgroundStyle.backgroundSize), 'important');
  };

  // All-day event
  if (segment === null) {
    return (
      <button
        ref={eventRef}
        onClick={(e) => onClick(event, e.currentTarget)}
        className={`absolute top-0 left-0 right-0 text-left p-2 rounded-md border border-border transition-colors ${
          isPast ? 'text-muted-foreground opacity-60' : ''
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
      ref={(el) => {
        eventRef(el);
        if (el) applyInlineStyles(el);
      }}
      onClick={(e) => onClick(event, e.currentTarget)}
      className={`absolute text-left rounded border border-border transition-colors overflow-hidden ${
        isPrimary ? 'p-1.5' : ''
      } ${isPast ? 'text-muted-foreground opacity-60' : ''} ${textClass} ${isCancelled ? 'line-through opacity-50' : ''}`}
      style={{
        top: `${segment.top}px`,
        height: `${segment.height}px`,
        minHeight: isPrimary ? '30px' : undefined,
        left: `${segment.left}%`,
        width: `${segment.width}%`,
        backgroundColor: backgroundStyle.backgroundColor,
        backgroundImage: backgroundStyle.backgroundImage,
        backgroundSize: backgroundStyle.backgroundSize,
      }}
    >
      {isPrimary && (
        <>
          <div className="text-xs font-medium truncate">{event.summary || 'No title'}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {formatTime(event.start.dateTime, event.start.date)}
          </div>
        </>
      )}
    </button>
  );
}
