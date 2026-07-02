import { CalendarConfig, CalendarEvent, CalendarEventsResponse, CalendarSource, GoogleCalendarMeta } from './types';
import { loadFromCache, saveToCache } from '@/lib/cache';

// @ts-ignore
import ICAL from 'ical.js';

// Pre-filter iCal text to remove old non-recurring events
// This avoids parsing huge files for events that won't be displayed
function preFilterICalText(icalText: string): string {
  const CUTOFF_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months
  const now = Date.now();
  const cutoffDate = new Date(now - CUTOFF_MS);
  const cutoffStr = cutoffDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const cutoffYMD = cutoffStr.substring(0, 8); // YYYYMMDD

  let result = '';
  let lastIndex = 0;
  let startIndex = 0;

  while ((startIndex = icalText.indexOf('BEGIN:VEVENT', lastIndex)) !== -1) {
    result += icalText.substring(lastIndex, startIndex);

    const endIndex = icalText.indexOf('END:VEVENT', startIndex);
    if (endIndex === -1) {
      result += icalText.substring(startIndex);
      lastIndex = icalText.length;
      break;
    }

    const eventBlockEnd = endIndex + 10;
    const eventBlock = icalText.substring(startIndex, eventBlockEnd);

    if (eventBlock.includes('RRULE:')) {
      result += eventBlock;
    } else {
      let dateVal = '';
      const endMatch = eventBlock.match(/DTEND(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/);
      if (endMatch) {
        dateVal = endMatch[1];
      } else {
        const startMatch = eventBlock.match(/DTSTART(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/);
        if (startMatch) dateVal = startMatch[1];
      }

      if (dateVal) {
        const eventYMD = dateVal.substring(0, 8);
        if (eventYMD >= cutoffYMD) {
          result += eventBlock;
        }
      } else {
        result += eventBlock;
      }
    }

    lastIndex = eventBlockEnd;
  }

  result += icalText.substring(lastIndex);
  return result;
}

function parseICal(icalText: string): CalendarEvent[] {
  try {
    const filteredText = preFilterICalText(icalText);
    const jcalData = ICAL.parse(filteredText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const eventsByUid = new Map<string, { main?: any; exceptions: any[] }>();

    vevents.forEach((vevent: any) => {
      const event = new ICAL.Event(vevent);
      const uid = event.uid;

      if (!eventsByUid.has(uid)) {
        eventsByUid.set(uid, { exceptions: [] });
      }

      if (event.recurrenceId) {
        eventsByUid.get(uid)!.exceptions.push(event);
      } else {
        eventsByUid.get(uid)!.main = event;
      }
    });

    const events: CalendarEvent[] = [];
    const now = new Date();
    // @ts-ignore
    const rangeStart = ICAL.Time.fromJSDate(new Date(now.getFullYear() - 1, now.getMonth(), 1));
    // @ts-ignore
    const rangeEnd = ICAL.Time.fromJSDate(new Date(now.getFullYear() + 2, now.getMonth(), 1));

    const convertToCalendarEvent = (event: any, start: any, end: any, idSuffix: string = ''): CalendarEvent => {
      const isAllDay = start.isDate;
      const organizer = event.organizer
        ? {
            email: event.organizer.replace(/^mailto:/i, ''),
            displayName: event.organizer,
          }
        : undefined;

      const attendees: any[] = [];
      if (event.component.hasProperty('attendee')) {
        const attendeeProps = event.component.getAllProperties('attendee');
        attendeeProps.forEach((prop: any) => {
          const email = prop.getFirstValue().replace(/^mailto:/i, '');
          attendees.push({
            email,
            displayName: prop.getParameter('cn'),
            responseStatus: prop.getParameter('partstat'),
            role: prop.getParameter('role'),
          });
        });
      }

      return {
        id: `${event.uid}${idSuffix}`,
        summary: event.summary || 'No title',
        description: event.description ? String(event.description) : undefined,
        location: event.location ? String(event.location) : undefined,
        start: isAllDay
          ? { date: `${start.year}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}` }
          : { dateTime: start.toJSDate().toISOString() },
        end: isAllDay
          ? { date: `${end.year}-${String(end.month).padStart(2, '0')}-${String(end.day).padStart(2, '0')}` }
          : { dateTime: end.toJSDate().toISOString() },
        status: 'confirmed',
        organizer,
        attendees,
        htmlLink: event.component.getFirstPropertyValue('url')
          ? String(event.component.getFirstPropertyValue('url'))
          : undefined,
      };
    };

    eventsByUid.forEach(({ main, exceptions }) => {
      const exceptionTimes = new Set<string>();

      exceptions.forEach((ex) => {
        const rid = ex.recurrenceId;
        if (rid) {
          exceptionTimes.add(rid.toICALString());
        }
        events.push(
          convertToCalendarEvent(
            ex,
            ex.startDate,
            ex.endDate,
            `_except_${rid ? rid.toICALString() : 'unknown'}`
          )
        );
      });

      if (main) {
        if (main.isRecurring()) {
          const iterator = main.iterator();
          let next: any;
          let count = 0;
          const maxCount = 2000;

          while ((next = iterator.next()) && count < maxCount) {
            const occ = main.getOccurrenceDetails(next);
            const occStart = occ.startDate;

            if (exceptionTimes.has(next.toICALString())) {
              continue;
            }

            if (occStart.compare(rangeEnd) > 0) break;
            if (occ.endDate.compare(rangeStart) < 0) continue;

            events.push(convertToCalendarEvent(main, occStart, occ.endDate, `_${occStart.toICALString()}`));
            count++;
          }
        } else {
          events.push(convertToCalendarEvent(main, main.startDate, main.endDate));
        }
      }
    });

    return events;
  } catch (e) {
    console.error('Error parsing iCal:', e);
    return [];
  }
}

async function fetchICalEvents(
  source: CalendarSource,
  period: string,
  forceRefresh: boolean = false,
  cacheKey?: string,
  cacheDuration?: number
): Promise<CalendarEvent[]> {
  const icalUrl = source.icalUrl!;
  const log = (msg: string, ...args: any[]) => console.log(`[iCal Fetch] ${msg}`, ...args);
  log('Starting fetch. Period:', period, 'ForceRefresh:', forceRefresh);

  try {
    try {
      new URL(icalUrl);
    } catch {
      throw new Error('Invalid iCal URL format. Please check the URL and try again.');
    }

    let cachedEvents: CalendarEvent[] | null = null;
    if (!forceRefresh && cacheKey && cacheDuration) {
      cachedEvents = await loadFromCache<CalendarEvent[]>(cacheKey, cacheDuration);
      log('Cache lookup result:', !!cachedEvents);
    }

    if (cachedEvents) {
      const { timeMin, timeMax } = getDateRange(period);
      const timeMinDate = new Date(timeMin);
      const timeMaxDate = new Date(timeMax);

      const filteredEvents = cachedEvents.filter((event) => {
        const startDate = event.start.dateTime
          ? new Date(event.start.dateTime)
          : event.start.date
          ? new Date(event.start.date)
          : null;
        if (!startDate) return false;
        const endDate = event.end?.dateTime
          ? new Date(event.end.dateTime)
          : event.end?.date
          ? new Date(event.end.date)
          : startDate;
        return startDate <= timeMaxDate && endDate >= timeMinDate;
      });

      filteredEvents.sort((a, b) => {
        const aStart = a.start.dateTime || a.start.date || '';
        const bStart = b.start.dateTime || b.start.date || '';
        return aStart.localeCompare(bStart);
      });

      return filteredEvents.map((e) => ({ ...e, sourceId: source.id }));
    }

    const url = new URL(icalUrl);
    if (forceRefresh) {
      url.searchParams.set('_t', Date.now().toString());
    }

    log('Fetching from URL:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/calendar, text/plain, */*',
        ...(forceRefresh ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {}),
      },
      cache: forceRefresh ? 'reload' : 'default',
    });

    log('Response status:', response.status);

    if (!response.ok) {
      const statusText = response.statusText || `HTTP ${response.status}`;
      if (response.status === 404) {
        throw new Error(`iCal URL not found (404). Please verify the URL is correct and publicly accessible.`);
      } else if (response.status === 403) {
        throw new Error(`Access forbidden (403). The iCal URL may not be publicly accessible.`);
      } else if (response.status === 401) {
        throw new Error(`Unauthorized (401). The iCal URL may require authentication.`);
      } else {
        throw new Error(`Failed to fetch iCal: ${statusText} (${response.status})`);
      }
    }

    const icalText = await response.text();
    log('Fetched text length:', icalText.length);

    if (!icalText || icalText.trim().length === 0) {
      throw new Error('The iCal URL returned an empty response. Please verify the URL is correct.');
    }

    if (!icalText.includes('BEGIN:VCALENDAR') && !icalText.includes('BEGIN:VEVENT')) {
      throw new Error('The URL does not appear to be a valid iCal file.');
    }

    let allEvents = parseICal(icalText);
    log('Parsed events count:', allEvents.length);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cutoffDate = new Date(todayStart);
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cacheCutoff = cutoffDate.getTime();

    const eventsToCache = allEvents.filter((event) => {
      const eventEnd = event.end?.dateTime || event.end?.date;
      if (!eventEnd) return false;
      return new Date(eventEnd).getTime() >= cacheCutoff;
    });

    if (cacheKey) {
      await saveToCache(cacheKey, eventsToCache);
    }

    const { timeMin, timeMax } = getDateRange(period);
    const timeMinDate = new Date(timeMin);
    const timeMaxDate = new Date(timeMax);

    const filteredEvents = allEvents.filter((event) => {
      const startDate = event.start.dateTime
        ? new Date(event.start.dateTime)
        : event.start.date
        ? new Date(event.start.date)
        : null;
      if (!startDate) return false;
      const endDate = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
        ? new Date(event.end.date)
        : startDate;
      return startDate <= timeMaxDate && endDate >= timeMinDate;
    });

    filteredEvents.sort((a, b) => {
      const aStart = a.start.dateTime || a.start.date || '';
      const bStart = b.start.dateTime || b.start.date || '';
      return aStart.localeCompare(bStart);
    });

    return filteredEvents.map((e) => ({ ...e, sourceId: source.id }));
  } catch (error) {
    console.error('Failed to fetch iCal events:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to fetch iCal events: ${String(error)}`);
    }
  }
}

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars';
const GOOGLE_OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function getChromeIdentity() {
  if (typeof chrome !== 'undefined' && chrome.identity) {
    return chrome.identity;
  }
  throw new Error('Chrome Identity API is not available');
}

function extractTokenFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hash = urlObj.hash.substring(1);
    const params = new URLSearchParams(hash);
    return params.get('access_token');
  } catch {
    return null;
  }
}

export async function authenticateGoogle(): Promise<{ accessToken: string; refreshToken?: string }> {
  return new Promise((resolve, reject) => {
    const identity = getChromeIdentity();

    identity.getAuthToken(
      {
        interactive: true,
        scopes: [GOOGLE_SCOPES],
      },
      (token) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || '';

          if (
            errorMsg.includes('Invalid oauth2 client ID') ||
            errorMsg.includes('OAuth2') ||
            errorMsg.includes('client ID')
          ) {
            if (GOOGLE_OAUTH_CLIENT_ID) {
              const redirectUri = chrome.identity.getRedirectURL();
              const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
              authUrl.searchParams.set('client_id', GOOGLE_OAUTH_CLIENT_ID);
              authUrl.searchParams.set('response_type', 'token');
              authUrl.searchParams.set('redirect_uri', redirectUri);
              authUrl.searchParams.set('scope', GOOGLE_SCOPES);

              identity.launchWebAuthFlow(
                {
                  url: authUrl.toString(),
                  interactive: true,
                },
                (responseUrl) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message || 'Authentication failed'));
                    return;
                  }
                  if (!responseUrl) {
                    reject(new Error('Failed to get authentication token'));
                    return;
                  }
                  const token = extractTokenFromUrl(responseUrl);
                  if (!token) {
                    reject(new Error('Failed to extract access token from response'));
                    return;
                  }
                  resolve({ accessToken: token });
                }
              );
            } else {
              reject(
                new Error(
                  'OAuth Client ID not configured.\n\n' +
                    'For local development, you need to:\n' +
                    '1. Create a Google OAuth Client ID (Web application type)\n' +
                    '2. Set VITE_GOOGLE_CLIENT_ID in your .env file\n' +
                    '3. Rebuild the extension\n\n' +
                    'See GOOGLE_CALENDAR_SETUP.md for detailed instructions.'
                )
              );
            }
          } else {
            reject(new Error(errorMsg || 'Failed to get authentication token'));
          }
          return;
        }
        if (!token) {
          reject(new Error('Failed to get authentication token'));
          return;
        }
        resolve({ accessToken: token });
      }
    );
  });
}

export async function revokeGoogleAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    const identity = getChromeIdentity();

    identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        identity.removeCachedAuthToken({ token }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

export async function checkGoogleAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    const identity = getChromeIdentity();
    identity.getAuthToken({ interactive: false }, (token) => {
      resolve(!!token && !chrome.runtime.lastError);
    });
  });
}

export async function ensureValidToken(accessToken: string | undefined): Promise<string> {
  if (!accessToken) {
    throw new Error('No access token available');
  }

  return new Promise((resolve) => {
    const identity = getChromeIdentity();

    identity.getAuthToken(
      {
        interactive: false,
        scopes: [GOOGLE_SCOPES],
      },
      (token) => {
        if (chrome.runtime.lastError) {
          resolve(accessToken);
          return;
        }
        resolve(token || accessToken);
      }
    );
  });
}

export async function refreshTokenSilently(): Promise<string | null> {
  return new Promise((resolve) => {
    const identity = getChromeIdentity();

    identity.getAuthToken(
      {
        interactive: false,
        scopes: [GOOGLE_SCOPES],
      },
      (token) => {
        if (chrome.runtime.lastError || !token) {
          resolve(null);
        } else {
          resolve(token);
        }
      }
    );
  });
}

export async function fetchGoogleCalendars(accessToken: string | undefined): Promise<GoogleCalendarMeta[]> {
  let token = accessToken;

  try {
    token = await ensureValidToken(accessToken);
  } catch (error) {
    if (!token) {
      throw error;
    }
  }

  const response = await fetch(GOOGLE_CALENDAR_LIST_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      try {
        const freshToken = await ensureValidToken(accessToken);
        const retryResponse = await fetch(GOOGLE_CALENDAR_LIST_URL, {
          headers: {
            Authorization: `Bearer ${freshToken}`,
          },
        });
        if (!retryResponse.ok) {
          throw new Error(`Failed to fetch calendars: ${retryResponse.statusText}`);
        }
        const data = await retryResponse.json();
        return data.items || [];
      } catch {
        throw new Error('Authentication expired. Please reconnect to Google Calendar.');
      }
    }
    throw new Error(`Failed to fetch calendars: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

function getDateRange(period: string): { timeMin: string; timeMax: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const minDate = new Date(today);
  const maxDate = new Date(today);

  if (period === 'month') {
    minDate.setMonth(minDate.getMonth() - 3);
    minDate.setDate(1);
    minDate.setHours(0, 0, 0, 0);
    maxDate.setMonth(maxDate.getMonth() + 4);
    maxDate.setDate(0);
    maxDate.setHours(23, 59, 59, 999);
  } else {
    minDate.setDate(minDate.getDate() - 14);
    minDate.setHours(0, 0, 0, 0);
    maxDate.setDate(maxDate.getDate() + 14);
    maxDate.setHours(23, 59, 59, 999);
  }

  return {
    timeMin: minDate.toISOString(),
    timeMax: maxDate.toISOString(),
  };
}

async function fetchOAuthSourceEvents(
  source: CalendarSource,
  period: string,
  _forceRefresh: boolean
): Promise<CalendarEvent[]> {
  if (!source.accessToken || !source.selectedCalendarIds || source.selectedCalendarIds.length === 0) {
    return [];
  }

  let token = source.accessToken;

  try {
    token = await ensureValidToken(source.accessToken);
  } catch (error) {
    if (!token) throw error;
  }

  const { timeMin, timeMax } = getDateRange(period);
  const allEvents: CalendarEvent[] = [];

  for (const calendarId of source.selectedCalendarIds) {
    try {
      const url = new URL(`${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '250');

      let response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        try {
          const freshToken = await ensureValidToken(source.accessToken);
          response = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${freshToken}`,
            },
          });
          token = freshToken;
        } catch {
          throw new Error('Authentication expired. Please reconnect to Google Calendar.');
        }
      }

      if (!response.ok) {
        console.error(`Failed to fetch events for calendar ${calendarId}: ${response.statusText}`);
        continue;
      }

      const data: CalendarEventsResponse = await response.json();
      if (data.items) {
        allEvents.push(...data.items.map((e) => ({ ...e, sourceId: source.id })));
      }
    } catch (error) {
      console.error(`Error fetching events for calendar ${calendarId}:`, error);
      if (error instanceof Error && error.message.includes('Authentication expired')) {
        throw error;
      }
    }
  }

  return allEvents;
}

export async function fetchCalendarEvents(
  config: CalendarConfig,
  forceRefresh: boolean = false,
  frameId?: string
): Promise<CalendarEvent[]> {
  const { sources, period, cacheDuration } = config;

  if (!sources || sources.length === 0) {
    return [];
  }

  // Fetch all sources in parallel
  const results = await Promise.allSettled(
    sources.map((source) => {
      if (source.type === 'ical') {
        if (!source.icalUrl) return Promise.resolve([]);
        const cacheKey = frameId ? `${frameId}_${source.id}` : undefined;
        return fetchICalEvents(source, period, forceRefresh, cacheKey, cacheDuration);
      } else {
        return fetchOAuthSourceEvents(source, period, forceRefresh);
      }
    })
  );

  const allEvents: CalendarEvent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    } else {
      console.error('Failed to fetch from a calendar source:', result.reason);
    }
  }

  // Filter out events declined by the user
  const visibleEvents = allEvents.filter((event) => {
    if (!event.attendees || event.attendees.length === 0) return true;
    const source = sources.find((s) => s.id === event.sourceId);
    const userEmail = source?.userEmail;
    if (!userEmail) return true;
    const userAttendee = event.attendees.find(
      (a) => a.email.toLowerCase() === userEmail.toLowerCase()
    );
    return !userAttendee || userAttendee.responseStatus?.toLowerCase() !== 'declined';
  });

  // Sort all events by start time
  visibleEvents.sort((a, b) => {
    const aStart = a.start.dateTime || a.start.date || '';
    const bStart = b.start.dateTime || b.start.date || '';
    return aStart.localeCompare(bStart);
  });

  return visibleEvents;
}

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    const startDate = event.start.dateTime
      ? new Date(event.start.dateTime)
      : event.start.date
      ? new Date(event.start.date)
      : null;

    if (!startDate) return;

    let endDate = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : event.end?.date
      ? new Date(event.end.date)
      : new Date(startDate);

    if (!event.end?.dateTime && !event.end?.date) {
      endDate = new Date(startDate);
    }

    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const stop = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

    const isAllDay = !!event.start.date;

    if (!isAllDay) {
      if (endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0 && endDate.getMilliseconds() === 0) {
        // keep stop as is (exclusive)
      } else {
        if (endDate.getTime() > stop.getTime()) {
          stop.setDate(stop.getDate() + 1);
        }
      }
    }

    let daysCount = 0;
    const MAX_DAYS = 366;

    while (current < stop && daysCount < MAX_DAYS) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}`;

      if (!grouped.has(dayKey)) {
        grouped.set(dayKey, []);
      }
      grouped.get(dayKey)!.push(event);

      current.setDate(current.getDate() + 1);
      daysCount++;
    }

    if (daysCount === 0) {
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}`;
      if (!grouped.has(dayKey)) grouped.set(dayKey, []);
      grouped.get(dayKey)!.push(event);
    }
  });

  return grouped;
}
