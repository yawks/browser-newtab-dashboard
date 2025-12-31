import { GoogleCalendarEvent } from './types';

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
export function getEventPosition(event: GoogleCalendarEvent): { top: number; height: number } | null {
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
export function eventsOverlap(event1: GoogleCalendarEvent, event2: GoogleCalendarEvent): boolean {
  if (!event1.start.dateTime || !event1.end?.dateTime || !event2.start.dateTime || !event2.end?.dateTime) {
    return false;
  }
  
  const start1 = new Date(event1.start.dateTime).getTime();
  const end1 = new Date(event1.end.dateTime).getTime();
  const start2 = new Date(event2.start.dateTime).getTime();
  const end2 = new Date(event2.end.dateTime).getTime();
  
  return start1 < end2 && start2 < end1;
}

/**
 * Calculate layout for overlapping events (like Google Calendar)
 */
export function calculateEventLayout(events: GoogleCalendarEvent[]): Map<string, { left: number; width: number }> {
  const layout = new Map<string, { left: number; width: number }>();
  
  if (events.length === 0) return layout;
      
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
    const sortedEvents = component
      .map(id => timedEvents.find(e => e.id === id)!)
      .sort((a, b) => {
        const startA = new Date(a.start.dateTime!).getTime();
        const startB = new Date(b.start.dateTime!).getTime();
        return startA - startB;
      });
    
    const columns: Map<string, number> = new Map();
    const eventEnds: Map<number, number> = new Map();
    
    sortedEvents.forEach(event => {
      const eventStartTime = new Date(event.start.dateTime!).getTime();
      const eventEndTime = new Date(event.end!.dateTime!).getTime();
      
      let column = 0;
      while (eventEnds.has(column) && eventEnds.get(column)! > eventStartTime) {
        column++;
      }
      
      columns.set(event.id, column);
      eventEnds.set(column, eventEndTime);
    });
    
    const maxColumns = Math.max(...Array.from(columns.values())) + 1;
    const spacingPercent = 4;
    const totalSpacingPercent = spacingPercent * (maxColumns - 1);
    const availableWidth = 100 - totalSpacingPercent;
    const eventWidth = availableWidth / maxColumns;
    
    sortedEvents.forEach(event => {
      const column = columns.get(event.id)!;
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
}

/**
 * Check if an event is in the past
 */
export function isEventPast(event: GoogleCalendarEvent): boolean {
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
  event: GoogleCalendarEvent,
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
export function findCurrentEvent(events: GoogleCalendarEvent[]): GoogleCalendarEvent | null {
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
export function getDaysForPeriod(period: string): Date[] {
  const days: Date[] = [];
  const now = new Date();
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
