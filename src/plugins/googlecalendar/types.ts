export type GoogleCalendarPeriod = '1-day' | '3-days' | '5-days' | 'week';

export interface GoogleCalendarConfig {
  accessToken?: string;
  refreshToken?: string;
  selectedCalendarIds: string[];
  period: GoogleCalendarPeriod;
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

