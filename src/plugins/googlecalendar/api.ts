import { GoogleCalendar, GoogleCalendarConfig, GoogleCalendarEvent, GoogleCalendarEventsResponse } from './types';

// @ts-ignore
import ICAL from 'ical.js';

// Parse iCal text using ical.js library


// Pre-filter iCal text to remove old non-recurring events
// This avoids parsing huge files for events that won't be displayed
function preFilterICalText(icalText: string): string {
  const CUTOFF_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months
  const now = Date.now();
  const cutoffDate = new Date(now - CUTOFF_MS);
  const cutoffStr = cutoffDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // YYYYMMDDTHHmmssZ approx
  const cutoffYMD = cutoffStr.substring(0, 8); // YYYYMMDD

  // Simple string builder
  let result = '';
  let lastIndex = 0;
  let startIndex = 0;
  
  // Find all VEVENT blocks
  while ((startIndex = icalText.indexOf('BEGIN:VEVENT', lastIndex)) !== -1) {
    // Append content before this event (headers, previous events, etc.)
    result += icalText.substring(lastIndex, startIndex);
    
    // Find end of generic event block
    const endIndex = icalText.indexOf('END:VEVENT', startIndex);
    if (endIndex === -1) {
        // Malformed, just keep everything else
        result += icalText.substring(startIndex);
        lastIndex = icalText.length;
        break;
    }
    
    const eventBlockEnd = endIndex + 10; // length of 'END:VEVENT'
    const eventBlock = icalText.substring(startIndex, eventBlockEnd);
    
    // Check retention criteria
    // 1. Keep if Recurrent (RRULE)
    if (eventBlock.includes('RRULE:')) {
        result += eventBlock;
    } else {
        // 2. Check dates (DTEND or DTSTART)
        // Extract DTEND or DTSTART
        // Optimization: Don't use heavy regex if possible, or use simple one
        // DTSTART:20250101...
        // DTSTART;TZID=...:20250101...
        
        let dateVal = '';
        
        // Try DTEND first, then DTSTART
        const endMatch = eventBlock.match(/DTEND(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/);
        if (endMatch) {
            dateVal = endMatch[1];
        } else {
            const startMatch = eventBlock.match(/DTSTART(?:;[^:]*)?:(\d{8}(?:T\d{6}Z?)?)/);
            if (startMatch) dateVal = startMatch[1];
        }
        
        if (dateVal) {
             // String comparison is enough for ISO-like dates (YYYYMMDD...) 
             // as long as we compare apples to apples.
             // But we have YYYYMMDD and YYYYMMDDTHHmmss.
             // Let's rely on YYYYMMDD part which is always first 8 chars.
             const eventYMD = dateVal.substring(0, 8);
             
             if (eventYMD >= cutoffYMD) {
                 result += eventBlock;
             } else {
                 // Discard (Old event)
             }
        } else {
            // No date found? Keep to be safe
            result += eventBlock;
        }
    }
    
    lastIndex = eventBlockEnd;
  }
  
  // Append remaining text (footer, etc.)
  result += icalText.substring(lastIndex);
  
  return result;
}

// Parse iCal text using ical.js library
function parseICal(icalText: string): GoogleCalendarEvent[] {
  try {
    // Pre-filter text to avoid processing unused old events
    const filteredText = preFilterICalText(icalText);
    const jcalData = ICAL.parse(filteredText);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');
    
    // Group events by UID to handle exceptions (RECURRENCE-ID)
    const eventsByUid = new Map<string, { main?: any, exceptions: any[] }>();
    
    vevents.forEach((vevent: any) => {
        const event = new ICAL.Event(vevent);
        const uid = event.uid;
        
        if (!eventsByUid.has(uid)) {
            eventsByUid.set(uid, { exceptions: [] });
        }
        
        if (event.recurrenceId) {
            eventsByUid.get(uid)!.exceptions.push(event);
        } else {
            // If multiple "main" events exist (unlikely in valid iCal but possible), last one wins or we handle as list?
            // Usually only one main definition per UID.
            eventsByUid.get(uid)!.main = event;
        }
    });

    const events: GoogleCalendarEvent[] = [];
    const now = new Date();
    // @ts-ignore
    const rangeStart = ICAL.Time.fromJSDate(new Date(now.getFullYear() - 1, now.getMonth(), 1)); // 1 year ago
    // @ts-ignore
    const rangeEnd = ICAL.Time.fromJSDate(new Date(now.getFullYear() + 2, now.getMonth(), 1)); // 2 years future
    
    // Helper to convert event to GoogleCalendarEvent
    const convertToGoogleEvent = (event: any, start: any, end: any, idSuffix: string = ''): GoogleCalendarEvent => {
        const isAllDay = start.isDate;
        const organizer = event.organizer ? {
            email: event.organizer.replace(/^mailto:/i, ''),
            displayName: event.organizer 
        } : undefined;
        
        const attendees: any[] = [];
        // Access component directly for properties that might not be on the Event wrapper wrapper
        if (event.component.hasProperty('attendee')) {
             const attendeeProps = event.component.getAllProperties('attendee');
             attendeeProps.forEach((prop: any) => {
                  const email = prop.getFirstValue().replace(/^mailto:/i, '');
                  attendees.push({
                      email,
                      displayName: prop.getParameter('cn'),
                      responseStatus: prop.getParameter('partstat'),
                      role: prop.getParameter('role')
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
            htmlLink: event.component.getFirstPropertyValue('url') ? String(event.component.getFirstPropertyValue('url')) : undefined,
        };
    };

    eventsByUid.forEach(({ main, exceptions }) => {
        // Map of exception times to skip in checking main recurrence
        const exceptionTimes = new Set<string>();
        
        // Add exception events
        exceptions.forEach(ex => {
            // recurrencId is the time of the original occurrence it replaces
            const rid = ex.recurrenceId;
            if (rid) {
                // Determine format based on rid type (date vs datetime)
                // We use toICALString() for consistent comparison? Or just compare Time objects?
                // Set stores string representation.
                exceptionTimes.add(rid.toICALString());
            }
            // Add the exception event itself
            events.push(convertToGoogleEvent(ex, ex.startDate, ex.endDate, `_except_${rid ? rid.toICALString() : 'unknown'}`));
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
                    
                    // Check if this occurrence matches an exception
                    if (exceptionTimes.has(next.toICALString())) {
                        // Skip this occurrence, it's handled by exception event
                        continue;
                    }

                    if (occStart.compare(rangeEnd) > 0) break;
                    if (occ.endDate.compare(rangeStart) < 0) continue;
                    
                    events.push(convertToGoogleEvent(main, occStart, occ.endDate, `_${occStart.toICALString()}`));
                    count++;
                }
            } else {
                // Single event (but might have exceptions if it was formerly recurring? Unlikely but possible)
                // If it's single, just add it. Exceptions would be weird here but we added them already.
                events.push(convertToGoogleEvent(main, main.startDate, main.endDate));
            }
        }
    });

    return events;
  } catch (e) {
    console.error('Error parsing iCal:', e);
    return [];
  }
}

// Format a date into a timezone-aware key: YYYYMMDDTHHMM (wall time)
function formatDateKey(dateInput: string | Date, _tzid?: string): string {
    // Only used for deduplication map now, kept simple
     const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
     return date.toISOString();
}

// Cache configuration
const ICAL_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const ICAL_CACHE_PREFIX = 'ical_cache_';

// Generate cache key from URL
function getCacheKey(icalUrl: string): string {
  // Use a simple hash of the URL as the key
  let hash = 0;
  for (let i = 0; i < icalUrl.length; i++) {
    const char = icalUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${ICAL_CACHE_PREFIX}${Math.abs(hash)}`;
}

// Check if cached events contain events for today
function hasTodayEvents(events: GoogleCalendarEvent[]): boolean {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  
  return events.some((event) => {
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
    
    return startDate <= todayEnd && endDate >= todayStart;
  });
}

// Load cached iCal events (returns expired cache if it has today's events)
async function loadCachedICalEvents(icalUrl: string, allowExpired: boolean = false): Promise<{ events: GoogleCalendarEvent[]; expired: boolean } | null> {
  return new Promise((resolve) => {
    const cacheKey = getCacheKey(icalUrl);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([cacheKey], (result) => {
        const cached = result[cacheKey];
        if (!cached) {
          resolve(null);
          return;
        }
        
        try {
          // Handle both string and already parsed objects
          const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
          const { events, timestamp } = data;
          const now = Date.now();
          const age = now - timestamp;
          
          // Check if cache is still valid
          if (age < ICAL_CACHE_DURATION) {
            resolve({ events, expired: false });
          } else {
            // Cache expired
            if (allowExpired && hasTodayEvents(events)) {
              resolve({ events, expired: true });
            } else {
              resolve(null);
            }
          }
        } catch (e) {
          console.error('[iCal Cache] Failed to parse cached iCal data:', e);
          resolve(null);
        }
      });
    } else {
      // Fallback to localStorage
      try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) {
          resolve(null);
          return;
        }
        
        const { events, timestamp } = JSON.parse(cached);
        const now = Date.now();
        const age = now - timestamp;
        
        if (age < ICAL_CACHE_DURATION) {
          resolve({ events, expired: false });
        } else {
          // Cache expired
          if (allowExpired && hasTodayEvents(events)) {
            resolve({ events, expired: true });
          } else {
            resolve(null);
          }
        }
      } catch (e) {
        console.error('[iCal Cache] Failed to load cached iCal data:', e);
        resolve(null);
      }
    }
  });
}

// Save iCal events to cache
async function saveCachedICalEvents(icalUrl: string, events: GoogleCalendarEvent[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const cacheKey = getCacheKey(icalUrl);
    const cacheData = {
      events,
      timestamp: Date.now(),
    };
    
    // console.log('[ICal Cache] Saving events to cache. Count:', events.length);
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [cacheKey]: JSON.stringify(cacheData) }, () => {
        if (chrome.runtime.lastError) {
          console.error('[iCal Cache] Failed to save to chrome.storage:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    } else {
      // Fallback to localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        resolve();
      } catch (e) {
        console.error('[iCal Cache] Failed to save cached iCal data to localStorage:', e);
        reject(e);
      }
    }
  });
}

// Refresh iCal cache in background (called when using stale cache)
async function refreshICalCache(icalUrl: string): Promise<void> {
  try {
    // Add cache busting to force refresh
    const url = new URL(icalUrl);
    url.searchParams.set('_t', Date.now().toString());

    // console.log('[ICal Cache] Background refreshing from:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      cache: 'reload',
    });
    
    if (!response.ok) {
      console.warn(`[iCal Cache] Background refresh failed: ${response.status} ${response.statusText}`);
      return;
    }
    
    const icalText = await response.text();
    
    if (!icalText || icalText.trim().length === 0) {
      console.warn('[iCal Cache] Background refresh returned empty response');
      return;
    }
    
    // Check if it looks like an iCal file
    if (!icalText.includes('BEGIN:VCALENDAR') && !icalText.includes('BEGIN:VEVENT')) {
      console.warn('[iCal Cache] Background refresh returned invalid iCal format');
      return;
    }
    
    const allEvents = parseICal(icalText);
    
    // Filter to keep only future events and today's events for cache
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Keep events from the last 90 days to ensure current month history is available
    const cutoffDate = new Date(todayStart);
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cacheCutoff = cutoffDate.getTime();
    
    const eventsToCache = allEvents.filter((event) => {
      const eventEnd = event.end?.dateTime || event.end?.date;
      if (!eventEnd) return false;
      
      const endDate = new Date(eventEnd);
      return endDate.getTime() >= cacheCutoff;
    });
    
    await saveCachedICalEvents(icalUrl, eventsToCache);
  } catch (error) {
    console.error('[iCal Cache] Background refresh error:', error);
  }
}

// Parse iCal datetime format (YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ)
// If tzid is provided, treat as local time in that timezone; otherwise treat as UTC if Z suffix
function parseICalDateTime(value: string, tzid?: string): Date {
  const isUTC = value.endsWith('Z');
  const cleanValue = value.replace(/Z$/, '');
  
  // Format: YYYYMMDDTHHmmss
  const year = parseInt(cleanValue.substring(0, 4), 10);
  const month = parseInt(cleanValue.substring(4, 6), 10) - 1; // Month is 0-indexed
  const day = parseInt(cleanValue.substring(6, 8), 10);
  const hour = cleanValue.length > 9 ? parseInt(cleanValue.substring(9, 11), 10) : 0;
  const minute = cleanValue.length > 11 ? parseInt(cleanValue.substring(11, 13), 10) : 0;
  const second = cleanValue.length > 13 ? parseInt(cleanValue.substring(13, 15), 10) : 0;
  
  if (isUTC || !tzid) {
    // If Z suffix or no timezone, treat as UTC
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  } else {
    // If timezone is specified, create date in local timezone
    return new Date(year, month, day, hour, minute, second);
  }
}

// Fetch events from iCal URL (background refresh if using stale cache)
async function fetchICalEvents(icalUrl: string, period: string, forceRefresh: boolean = false): Promise<GoogleCalendarEvent[]> {
  const log = (msg: string, ...args: any[]) => console.log(`[iCal Fetch] ${msg}`, ...args);
  log('Starting fetch. Period:', period, 'ForceRefresh:', forceRefresh);

  try {
    // Validate URL format
    try {
      new URL(icalUrl);
    } catch {
      throw new Error('Invalid iCal URL format. Please check the URL and try again.');
    }

    // Try to load from cache first (allow expired cache if it has today's events)
    // If forceRefresh is true, skip cache lookup
    let cachedResult = null;
    if (!forceRefresh) {
      cachedResult = await loadCachedICalEvents(icalUrl, true);
      log('Cache lookup result:', !!cachedResult);
    } else {
      log('Skipping cache due to forceRefresh');
    }
    
    if (cachedResult) {
      const { events: cachedEvents, expired } = cachedResult;
      
      // Filter cached events by period
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
      
      // Sort by start time
      filteredEvents.sort((a, b) => {
        const aStart = a.start.dateTime || a.start.date || '';
        const bStart = b.start.dateTime || b.start.date || '';
        return aStart.localeCompare(bStart);
      });
      
      // If cache is expired, refresh in background
      if (expired) {
        log('Cache expired, triggering background refresh');
        // Don't await - refresh in background
        refreshICalCache(icalUrl).catch((err: unknown) => {
          console.error('[iCal Cache] Background refresh failed:', err);
        });
      }
      
      return filteredEvents;
    }

    // Cache miss or expired without today's events, fetch from URL
    const url = new URL(icalUrl);
    // Add cache busting if forcing refresh
    if (forceRefresh) {
      url.searchParams.set('_t', Date.now().toString());
    }

    log('Fetching from URL:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
        ...(forceRefresh ? { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } : {}),
      },
      cache: forceRefresh ? 'reload' : 'default',
    });
    
    log('Response status:', response.status);

    if (!response.ok) {
      const statusText = response.statusText || `HTTP ${response.status}`;
      if (response.status === 404) {
        throw new Error(`iCal URL not found (404). Please verify the URL is correct and publicly accessible.`);
      } else if (response.status === 403) {
        throw new Error(`Access forbidden (403). The iCal URL may require authentication or may not be publicly accessible.`);
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
    
    // Check if it looks like an iCal file
    if (!icalText.includes('BEGIN:VCALENDAR') && !icalText.includes('BEGIN:VEVENT')) {
      throw new Error('The URL does not appear to be a valid iCal file. Please verify the URL points to an .ics file.');
    }
    
    let allEvents = parseICal(icalText);
    log('Parsed events count:', allEvents.length);

    // Deduplicate events: if there's a RECURRENCE-ID event, remove the corresponding generated occurrence
    // Events with RECURRENCE-ID have IDs like "uid-recurrence-20251215T140000"
    // Generated occurrences have IDs like "uid-0", "uid-1", etc.
    // We match on base UID + original occurrence start (wall time in the proper TZ) to avoid duplicates when an instance is rescheduled.
    const recurrenceIdMap = new Map<string, GoogleCalendarEvent>();
    const regularEvents: GoogleCalendarEvent[] = [];
    const buildOccurrenceKey = (baseUid: string, dateValue: Date | string, tzid?: string): string =>
      `${baseUid}-${formatDateKey(dateValue, tzid || 'Europe/Paris')}`; // Default to Europe/Paris for consistency
    
    for (const event of allEvents) {
      if (event.id.includes('-recurrence-')) {
        // Extract the base UID from the ID
        const match = event.id.match(/^(.+)-recurrence-(.+)$/);
        if (match) {
          const baseUid = match[1];
          // Prefer the RECURRENCE-ID value (original occurrence start) if present
          const recurrenceIdValue = event.id.split('-recurrence-')[1];
          let occurrenceDate: Date | null = null;

          if (recurrenceIdValue) {
            // If we stored tzid during parsing, try to parse with it
            const tzid = (event as any).recurrenceIdTzid as string | undefined;
            try {
              occurrenceDate = parseICalDateTime(recurrenceIdValue, tzid);
            } catch {
              occurrenceDate = null;
            }
          }

          // Fallback to the event's own start date
          if (!occurrenceDate && event.start.dateTime) {
            occurrenceDate = new Date(event.start.dateTime);
          }

          if (occurrenceDate) {
            const tz = (event.start as any)?.timeZone || (event as any).recurrenceIdTzid;
            const key = buildOccurrenceKey(baseUid, occurrenceDate, tz);
            recurrenceIdMap.set(key, event);
          }
        }
      } else {
        regularEvents.push(event);
      }
    }
    
    // Filter out generated occurrences that have a corresponding RECURRENCE-ID event
    const deduplicatedEvents = regularEvents.filter((event) => {
      // Check if this event's date matches a RECURRENCE-ID event
      if (event.start.dateTime) {
        const eventDate = new Date(event.start.dateTime);
        // Extract base UID (everything before the last dash and number)
        const uidMatch = event.id.match(/^(.+?)-(\d+)$/);
        if (uidMatch) {
          const baseUid = uidMatch[1];
          const tz = (event.start as any)?.timeZone || 'Europe/Paris'; // Use same tz as RECURRENCE-ID
          const key = buildOccurrenceKey(baseUid, eventDate, tz);
          if (recurrenceIdMap.has(key)) {
            // This occurrence is replaced by a RECURRENCE-ID event, exclude it
            return false;
          }
        }
      }
      return true;
    });
    
    // Add back the RECURRENCE-ID events
    allEvents = [...deduplicatedEvents, ...Array.from(recurrenceIdMap.values())];
    
    // Filter to keep only future events and today's events for cache (to save storage space)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Keep events from the last 90 days to ensure current month history is available
    const cutoffDate = new Date(todayStart);
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cacheCutoff = cutoffDate.getTime();
    
    const eventsToCache = allEvents.filter((event) => {
      const eventEnd = event.end?.dateTime || event.end?.date;
      if (!eventEnd) return false;
      
      const endDate = new Date(eventEnd);
      // Keep events that haven't ended yet, or ended today or later
      return endDate.getTime() >= cacheCutoff;
    });
    
    // Save to cache (save only future/today events to reduce storage size)
    await saveCachedICalEvents(icalUrl, eventsToCache);
    
    // Filter events by period
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
      
      // Include events that start within the period or overlap with it
      const endDate = event.end?.dateTime 
        ? new Date(event.end.dateTime)
        : event.end?.date 
        ? new Date(event.end.date)
        : startDate;
      
      const isInRange = startDate <= timeMaxDate && endDate >= timeMinDate;
      
      return isInRange;
    });
    
    // Sort by start time
    filteredEvents.sort((a, b) => {
      const aStart = a.start.dateTime || a.start.date || '';
      const bStart = b.start.dateTime || b.start.date || '';
      return aStart.localeCompare(bStart);
    });
    
    return filteredEvents;
  } catch (error) {
    console.error('Failed to fetch iCal events:', error);
    // Re-throw with more context if it's not already a detailed error
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

// Helper to get Chrome identity API
function getChromeIdentity() {
  if (typeof chrome !== 'undefined' && chrome.identity) {
    return chrome.identity;
  }
  throw new Error('Chrome Identity API is not available');
}

// Extract access token from OAuth callback URL
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

// Get OAuth token using Chrome Identity API with launchWebAuthFlow
export async function authenticateGoogle(): Promise<{ accessToken: string; refreshToken?: string }> {
  return new Promise((resolve, reject) => {
    const identity = getChromeIdentity();
    
    // First try getAuthToken (works for published extensions with OAuth2 in manifest)
    identity.getAuthToken(
      {
        interactive: true,
        scopes: [GOOGLE_SCOPES],
      },
      (token) => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || '';
          
          // If error is about invalid client ID, try launchWebAuthFlow
          if (errorMsg.includes('Invalid oauth2 client ID') || errorMsg.includes('OAuth2') || errorMsg.includes('client ID')) {
            // Fallback to launchWebAuthFlow if Client ID is configured
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
              reject(new Error(
                'OAuth Client ID not configured.\n\n' +
                'For local development, you need to:\n' +
                '1. Create a Google OAuth Client ID (Web application type)\n' +
                '2. Set VITE_GOOGLE_CLIENT_ID in your .env file\n' +
                '3. Rebuild the extension\n\n' +
                'See GOOGLE_CALENDAR_SETUP.md for detailed instructions.'
              ));
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

// Remove authentication
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

// Check if user is authenticated
export async function checkGoogleAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    const identity = getChromeIdentity();
    
    identity.getAuthToken({ interactive: false }, (token) => {
      resolve(!!token && !chrome.runtime.lastError);
    });
  });
}

// Check if token is valid and refresh if needed
export async function ensureValidToken(accessToken: string | undefined): Promise<string> {
  if (!accessToken) {
    throw new Error('No access token available');
  }

  // Try to use Chrome Identity API to get a fresh token (it handles refresh automatically)
  // This works best for extensions using getAuthToken (published extensions or with OAuth2 in manifest)
  return new Promise((resolve) => {
    const identity = getChromeIdentity();
    
    // Try to get a fresh token using Chrome Identity API
    // Chrome automatically refreshes tokens obtained via getAuthToken
    identity.getAuthToken(
      {
        interactive: false, // Don't prompt user, just try to refresh
        scopes: [GOOGLE_SCOPES],
      },
      (token) => {
        if (chrome.runtime.lastError) {
          // If getAuthToken fails, the token might be from launchWebAuthFlow
          // In that case, we can't refresh automatically and need to re-authenticate
          // But first, try the stored token - it might still be valid
          resolve(accessToken);
          return;
        }
        if (token) {
          // Got a fresh token from Chrome Identity API (automatically refreshed if needed)
          resolve(token);
        } else {
          // Fallback to stored token
          resolve(accessToken);
        }
      }
    );
  });
}

// Re-authenticate silently if possible
export async function refreshTokenSilently(): Promise<string | null> {
  return new Promise((resolve) => {
    const identity = getChromeIdentity();
    
    // Try to get a fresh token without user interaction
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

// Fetch list of calendars with automatic token refresh
export async function fetchGoogleCalendars(accessToken: string | undefined): Promise<GoogleCalendar[]> {
  let token = accessToken;
  
  // Try to get a fresh token first
  try {
    token = await ensureValidToken(accessToken);
  } catch (error) {
    // If token refresh fails, try with the original token
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
      // Token expired, try to refresh
      try {
        const freshToken = await ensureValidToken(accessToken);
        // Retry with fresh token
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
      } catch (refreshError) {
        throw new Error('Authentication expired. Please reconnect to Google Calendar.');
      }
    }
    throw new Error(`Failed to fetch calendars: ${response.statusText}`);
  }

  const data = await response.json();
  return data.items || [];
}

// Calculate date range based on period
function getDateRange(period: string): { timeMin: string; timeMax: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let days = 1;
  switch (period) {
    case '1-day':
      days = 1;
      break;
    case '3-days':
      days = 3;
      break;
    case '5-days':
      days = 5;
      break;
    case 'week':
      days = 7;
      break;
    case 'month':
      // For month view, we need a special calculation
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      // Add buffer (1 week before and after) to cover grid overlaps
      const timeMin = new Date(firstDayOfMonth);
      timeMin.setDate(timeMin.getDate() - 7);
      timeMin.setHours(0, 0, 0, 0);
      
      const timeMax = new Date(lastDayOfMonth);
      timeMax.setDate(timeMax.getDate() + 7);
      timeMax.setHours(23, 59, 59, 999);
      
      return {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      };
    default:
      days = 1;
  }

  const timeMin = new Date(today);
  timeMin.setHours(0, 0, 0, 0);
  
  const timeMax = new Date(today);
  // For 1-day, we want today only (days - 1 = 0 days added)
  // For 3-days, we want today + 2 more days (days - 1 = 2 days added)
  // etc.
  timeMax.setDate(timeMax.getDate() + days - 1);
  timeMax.setHours(23, 59, 59, 999);

  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  };
}

// Fetch events for selected calendars with automatic token refresh
export async function fetchGoogleCalendarEvents(
  config: GoogleCalendarConfig,
  forceRefresh: boolean = false
): Promise<GoogleCalendarEvent[]> {
  const authType = config.authType || (config.accessToken ? 'oauth' : 'ical');
  
  // Handle iCal URL
  if (authType === 'ical') {
    if (!config.icalUrl) {
      return [];
    }
    return fetchICalEvents(config.icalUrl, config.period, forceRefresh);
  }
  
  // Handle OAuth
  if (!config.accessToken || !config.selectedCalendarIds || config.selectedCalendarIds.length === 0) {
    return [];
  }

  let token = config.accessToken;
  
  // Try to get a fresh token first
  try {
    token = await ensureValidToken(config.accessToken);
  } catch (error) {
    // If token refresh fails, try with the original token
    if (!token) {
      throw error;
    }
  }

  const { timeMin, timeMax } = getDateRange(config.period);
  const allEvents: GoogleCalendarEvent[] = [];

  // Fetch events from each selected calendar
  for (const calendarId of config.selectedCalendarIds) {
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

      // If token expired, try to refresh and retry
      if (response.status === 401) {
        try {
          const freshToken = await ensureValidToken(config.accessToken);
          response = await fetch(url.toString(), {
            headers: {
              Authorization: `Bearer ${freshToken}`,
            },
          });
          token = freshToken; // Update token for subsequent requests
        } catch (refreshError) {
          throw new Error('Authentication expired. Please reconnect to Google Calendar.');
        }
      }

      if (!response.ok) {
        console.error(`Failed to fetch events for calendar ${calendarId}: ${response.statusText}`);
        continue;
      }

      const data: GoogleCalendarEventsResponse = await response.json();
      if (data.items) {
        allEvents.push(...data.items);
      }
    } catch (error) {
      console.error(`Error fetching events for calendar ${calendarId}:`, error);
      // If it's an auth error, rethrow it
      if (error instanceof Error && error.message.includes('Authentication expired')) {
        throw error;
      }
    }
  }

  // Sort all events by start time
  allEvents.sort((a, b) => {
    const aStart = a.start.dateTime || a.start.date || '';
    const bStart = b.start.dateTime || b.start.date || '';
    return aStart.localeCompare(bStart);
  });

  return allEvents;
}

// Get events grouped by day
export function groupEventsByDay(events: GoogleCalendarEvent[]): Map<string, GoogleCalendarEvent[]> {
  const grouped = new Map<string, GoogleCalendarEvent[]>();

  events.forEach((event) => {
    const startDate = event.start.dateTime 
      ? new Date(event.start.dateTime)
      : event.start.date 
      ? new Date(event.start.date)
      : null;
      
    if (!startDate) return;

    // Determine end date (exclusive for all-day, inclusive/point for timed?)
    // For grouping, we want to cover all days that the event touches.
    // If it's all-day, end date is usually T+1 00:00. So we iterate until end-1 day.
    // If it's timed, we iterate all days it touches.
    
    let endDate = event.end?.dateTime 
      ? new Date(event.end.dateTime)
      : event.end?.date 
      ? new Date(event.end.date)
      : new Date(startDate);

    // If no end date, assume same day
    if (!event.end?.dateTime && !event.end?.date) {
      endDate = new Date(startDate);
    }
    
    // Normalize to dates (midnight representation for iteration)
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const stop = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    // If it's data-only all-day event, the end date is exclusive.
    // e.g. Start 2025-01-01, End 2025-01-02 -> Only 2025-01-01.
    // e.g. Start 2025-01-01, End 2025-01-04 -> 01, 02, 03.
    // For timed events: Start 2025-01-01 23:00, End 2025-01-02 01:00 -> 01, 02.
    // We'll iterate while current < stop (if all-day) or current <= stop (if timed and touches next day?)
    // To simplify: iterate from start day. If it's all-day, stop before end day.
    // If it's timed and ends at midnight, stop before. If ends after midnight, include.
    
    const isAllDay = !!event.start.date;
    
    // Adjust stop condition
    if (isAllDay) {
       // All-day end is exclusive
    } else {
       // Timed event. 
       // If end is exactly 00:00:00, it belongs to previous day (effectively exclusive).
       if (endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getSeconds() === 0 && endDate.getMilliseconds() === 0) {
         // keep stop as is (exclusive)
       } else {
         // ends during the day, so that day is included. 
         // But our loop creates dates at 00:00.
         // If start is 01-01 23:00, end 01-02 01:00.
         // current = 01-01. stop = 01-02.
         // We want to include 01-02. 
         // So we need to iterate while current <= stop?
         // If we iterate current <= stop, we get 01-02. Correct.
         // But wait, if event is on single day 13:00 to 14:00. current=01-01, stop=01-01.
         // current <= stop -> runs once. Correct.
         
         // So for timed events, we want <= stop?
         // But wait, what if we manually increment current and check?
         
         // Let's use a simpler approach: 
         // Always treat as inclusive range of days.
         // If (timed) end > start date-part, include end date-part.
         // Unless end is exactly midnight?
         if (endDate.getTime() > stop.getTime()) {
            // End has time component on the stop day (e.g. 01:00)
            // So we include it.
            // We can just increment stop by 1 day to make the < loop work?
            stop.setDate(stop.getDate() + 1);
         }
       }
    }
    
    // Safety break to prevent infinite loops for bad data
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

      // Next day
      current.setDate(current.getDate() + 1);
      daysCount++;
    }
    
    // Fallback: if loop didn't run (e.g. timed event 13:00-14:00, start=stop, no increment), add at least start date
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

