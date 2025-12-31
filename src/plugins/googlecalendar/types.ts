export type GoogleCalendarPeriod = '1-day' | '3-days' | '5-days' | 'week' | 'month';
export type GoogleCalendarAuthType = 'oauth' | 'ical';

export interface GoogleCalendarConfig {
  authType?: GoogleCalendarAuthType; // 'oauth' or 'ical'
  accessToken?: string; // For OAuth
  refreshToken?: string; // For OAuth
  selectedCalendarIds?: string[]; // For OAuth
  icalUrl?: string; // For iCal public URL
  period: GoogleCalendarPeriod;
  userEmail?: string; // Current user's email for status detection
  // Which day week starts on in month view ('sunday' or 'monday')
  weekStart?: 'sunday' | 'monday';
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
}

export interface GoogleCalendarEvent {
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
    role?: string; // REQ-PARTICIPANT, OPT-PARTICIPANT, etc.
  }>;
  organizer?: {
    email: string;
    displayName?: string;
  };
  htmlLink?: string;
  colorId?: string;
  status?: string;
}

export interface GoogleCalendarEventsResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

