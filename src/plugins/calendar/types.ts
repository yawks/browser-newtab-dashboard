export type CalendarPeriod = '1-day' | '3-days' | '5-days' | 'week' | 'month';
export type CalendarSourceType = 'oauth' | 'ical';

export interface CalendarSource {
  id: string;
  type: CalendarSourceType;
  name?: string;
  // OAuth
  accessToken?: string;
  selectedCalendarIds?: string[];
  // Both OAuth and iCal
  userEmail?: string;
  // iCal
  icalUrl?: string;
}

export interface CalendarConfig {
  sources: CalendarSource[];
  period: CalendarPeriod;
  weekStart?: 'sunday' | 'monday';
  cacheDuration?: number;
}

export interface GoogleCalendarMeta {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    role?: string;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
  };
  htmlLink?: string;
  colorId?: string;
  status?: string;
  sourceId?: string; // ID of the CalendarSource this event comes from
}

export interface CalendarEventsResponse {
  items: CalendarEvent[];
  nextPageToken?: string;
}

/**
 * Migrate old single-source config format to new multi-source format.
 * Safe to call on already-migrated configs.
 */
export function migrateConfig(raw: any): CalendarConfig {
  if (raw?.sources) {
    // Already new format
    return raw as CalendarConfig;
  }

  // Old format: migrate to new
  if (raw?.authType || raw?.accessToken || raw?.icalUrl) {
    const source: CalendarSource = {
      id: 'migrated-1',
      type: raw.authType || (raw.accessToken ? 'oauth' : 'ical'),
      accessToken: raw.accessToken,
      selectedCalendarIds: raw.selectedCalendarIds,
      userEmail: raw.userEmail,
      icalUrl: raw.icalUrl,
    };
    return {
      sources: [source],
      period: raw.period || '1-day',
      weekStart: raw.weekStart || 'monday',
      cacheDuration: raw.cacheDuration ?? 3600,
    };
  }

  // Empty config
  return {
    sources: [],
    period: '1-day',
    weekStart: 'monday',
    cacheDuration: 3600,
  };
}
