import { CalendarEvent } from './types';

/**
 * Format time from ISO string or date string
 */
export function formatTime(dateTime?: string, date?: string): string {
  if (dateTime) {
    const d = new Date(dateTime);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (date) {
    return 'All day';
  }
  return '';
}

/**
 * Format date string (YYYY-MM-DD) to human readable format
 */
export function formatDate(dateString: string): string {
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
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Get status icon and color for attendee response status
 */
export function getStatusIcon(status?: string) {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
      return { icon: 'CheckCircle2', color: 'text-green-500', label: 'Accepted' };
    case 'DECLINED':
      return { icon: 'XCircle', color: 'text-red-500', label: 'Declined' };
    case 'TENTATIVE':
      return { icon: 'HelpCircle', color: 'text-yellow-500', label: 'Tentative' };
    case 'NEEDS-ACTION':
    default:
      return { icon: 'Circle', color: 'text-gray-400', label: 'No response' };
  }
}

/**
 * Calculate event position and height based on time
 */
export function getEventPosition(event: CalendarEvent): { top: number; height: number } | null {
  if (!event.start.dateTime || !event.end?.dateTime) {
    return null; // All-day events or events without time
  }

  const startDate = new Date(event.start.dateTime);
  const endDate = new Date(event.end.dateTime);
  
  const startHour = startDate.getHours() + startDate.getMinutes() / 60;
  const endHour = endDate.getHours() + endDate.getMinutes() / 60;
  
  const hourHeight = 60;
  const verticalSpacing = 4;
  const top = startHour * hourHeight;
  const height = (endHour - startHour) * hourHeight - verticalSpacing;
  
  return { top, height: Math.max(height, 30) };
}

/**
 * Check if two events overlap
 */
export function eventsOverlap(event1: CalendarEvent, event2: CalendarEvent): boolean {
  if (!event1.start.dateTime || !event1.end?.dateTime || !event2.start.dateTime || !event2.end?.dateTime) {
    return false;
  }
  
  const start1 = new Date(event1.start.dateTime).getTime();
  const end1 = new Date(event1.end.dateTime).getTime();
  const start2 = new Date(event2.start.dateTime).getTime();
  const end2 = new Date(event2.end.dateTime).getTime();
  
  return start1 < end2 && start2 < end1;
}

export type EventSegment = {
  top: number;
  height: number;
  left: number;
  width: number;
};

/**
 * Calculate layout for overlapping events.
 *
 * Each event gets a fixed column for its entire duration (never split into
 * multiple segments). Columns are assigned greedily by start time; width is
 * determined by the highest column index among all directly-overlapping events.
 */
export function calculateEventLayout(events: CalendarEvent[]): Map<string, EventSegment[]> {
  const result = new Map<string, EventSegment[]>();

  if (events.length === 0) return result;

  const timedEvents = events.filter(e => e.start.dateTime && e.end?.dateTime);
  if (timedEvents.length === 0) return result;

  timedEvents.forEach(e => result.set(e.id, []));

  const spacingPercent = 2;
  const verticalSpacing = 4;

  // Sort by start time, then longer events first
  const sorted = [...timedEvents].sort((a, b) => {
    const startDiff = new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime();
    if (startDiff !== 0) return startDiff;
    const durA = new Date(a.end!.dateTime!).getTime() - new Date(a.start.dateTime!).getTime();
    const durB = new Date(b.end!.dateTime!).getTime() - new Date(b.start.dateTime!).getTime();
    return durB - durA;
  });

  // Greedy column assignment: each event goes in the first column that is free
  const eventCol = new Map<string, number>();
  const colEndTimes: number[] = [];

  for (const event of sorted) {
    const start = new Date(event.start.dateTime!).getTime();
    const end = new Date(event.end!.dateTime!).getTime();
    let col = 0;
    while (col < colEndTimes.length && colEndTimes[col] > start) col++;
    eventCol.set(event.id, col);
    colEndTimes[col] = end;
  }

  // For each event, find the number of columns needed across its overlap group
  for (const event of timedEvents) {
    const eStart = new Date(event.start.dateTime!).getTime();
    const eEnd = new Date(event.end!.dateTime!).getTime();
    const col = eventCol.get(event.id)!;

    const overlapping = timedEvents.filter(e => {
      if (e.id === event.id) return false;
      const s = new Date(e.start.dateTime!).getTime();
      const en = new Date(e.end!.dateTime!).getTime();
      return s < eEnd && en > eStart;
    });

    const numCols = overlapping.length === 0
      ? 1
      : Math.max(col, ...overlapping.map(e => eventCol.get(e.id)!)) + 1;

    const eventWidth = numCols === 1 ? 100 : (100 - spacingPercent * (numCols - 1)) / numCols;
    const left = numCols === 1 ? 0 : col * (eventWidth + spacingPercent);

    const startDate = new Date(event.start.dateTime!);
    const endDate = new Date(event.end!.dateTime!);
    const topPx = startDate.getHours() * 60 + startDate.getMinutes();
    const heightPx = endDate.getHours() * 60 + endDate.getMinutes() - topPx;

    result.set(event.id, [{
      top: topPx,
      height: Math.max(heightPx - verticalSpacing, 1),
      left,
      width: eventWidth,
    }]);
  }

  return result;
}

/**
 * Check if an event is in the past
 */
export function isEventPast(event: CalendarEvent): boolean {
  const now = new Date();
  const eventEnd = event.end?.dateTime || event.end?.date;
  if (!eventEnd) return false;
  
  const endDate = new Date(eventEnd);
  return endDate < now;
}

/**
 * Get user's response status for an event
 */
export function getUserResponseStatus(
  event: CalendarEvent,
  userEmail?: string
): 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION' | null {
  if (!event.attendees || event.attendees.length === 0) {
    return null;
  }

  const normalizedUserEmail = userEmail?.toLowerCase();
  
  if (normalizedUserEmail) {
    const userAttendee = event.attendees.find(
      (attendee) => attendee.email?.toLowerCase() === normalizedUserEmail
    );
    if (userAttendee?.responseStatus) {
      const status = userAttendee.responseStatus.toUpperCase();
      if (status === 'ACCEPTED' || status === 'DECLINED' || status === 'TENTATIVE') {
        return status as 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
      }
    }
    return null;
  }

  return null;
}

/**
 * Find the current or next event (excluding all-day events)
 */
export function findCurrentEvent(events: CalendarEvent[]): CalendarEvent | null {
  const now = new Date();
  
  for (const event of events) {
    if (event.start.date && !event.start.dateTime) {
      continue;
    }
    
    const eventStart = event.start.dateTime ? new Date(event.start.dateTime) : null;
    const eventEnd = event.end?.dateTime || event.end?.date;
    
    if (eventStart && eventEnd) {
      const endDate = new Date(eventEnd);
      if (endDate >= now) {
        return event;
      }
    }
  }
  
  return null;
}

/**
 * Get days for the specified period
 */
export function getDaysForPeriod(period: string, startDate?: Date): Date[] {
  const days: Date[] = [];
  const now = startDate ? new Date(startDate) : new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let count = 1;
  switch (period) {
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
}

/**
 * Build a month grid (array of weeks, each week is an array of 7 Date objects).
 * weekStartsOnMonday - if true, the first column is Monday, otherwise Sunday.
 */
export function getMonthGrid(date: Date, weekStartsOnMonday = true): Date[][] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  // JavaScript: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const firstDayIndex = firstOfMonth.getDay();
  const startOffset = weekStartsOnMonday ? (firstDayIndex === 0 ? 6 : firstDayIndex - 1) : firstDayIndex;

  const startDate = new Date(firstOfMonth);
  startDate.setDate(firstOfMonth.getDate() - startOffset);

  const weeks: Date[][] = [];
  let current = new Date(startDate);

  while (current <= lastOfMonth || weeks.length === 0 || weeks[weeks.length - 1].length < 7) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);

    // Safety: stop if too many weeks (shouldn't happen) - but limit to 6 weeks
    if (weeks.length > 6) break;
  }

  return weeks;
}

/**
 * Get CSS variable value from root
 */
export function getCSSVarValue(varName: string): string {
  if (typeof window !== 'undefined' && document.documentElement) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || '';
  }
  return '';
}
