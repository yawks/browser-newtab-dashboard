import { GoogleCalendar, GoogleCalendarConfig, GoogleCalendarEvent, GoogleCalendarEventsResponse } from './types';

// Interface for storing recurrence information during parsing
interface RecurrenceInfo {
  rrule?: string;
  exdate?: string[];
  status?: string;
  recurrenceId?: string; // RECURRENCE-ID for modified instances
}

// Simple iCal parser with RRULE support
function parseICal(icalText: string): GoogleCalendarEvent[] {
  const events: GoogleCalendarEvent[] = [];
  const lines = icalText.split(/\r?\n/);
  
  let currentEvent: Partial<GoogleCalendarEvent> | null = null;
  let recurrenceInfo: RecurrenceInfo = {};
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line continuation (lines starting with space)
    while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
      line += lines[i + 1].substring(1);
      i++;
    }
    
    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = {
        start: {},
        end: {},
      };
      recurrenceInfo = {};
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      // If no end date, use start date + 1 hour for timed events, or same day for all-day
      if (!currentEvent.end?.dateTime && !currentEvent.end?.date) {
        if (currentEvent.start?.dateTime) {
          const startDate = new Date(currentEvent.start.dateTime);
          startDate.setHours(startDate.getHours() + 1);
          currentEvent.end = { dateTime: startDate.toISOString() };
        } else if (currentEvent.start?.date) {
          currentEvent.end = { date: currentEvent.start.date };
        }
      }
      
      // Convert to GoogleCalendarEvent format
      const baseEvent: GoogleCalendarEvent = {
        id: currentEvent.id || `ical-${Date.now()}-${Math.random()}`,
        summary: currentEvent.summary || 'No title',
        description: currentEvent.description,
        start: {
          dateTime: currentEvent.start?.dateTime,
          date: currentEvent.start?.date,
        },
        end: {
          dateTime: currentEvent.end?.dateTime,
          date: currentEvent.end?.date,
        },
        location: currentEvent.location,
        htmlLink: currentEvent.htmlLink,
        status: recurrenceInfo.status,
        organizer: currentEvent.organizer,
        attendees: currentEvent.attendees,
      };
      
      // If there's a RECURRENCE-ID, this is a modified instance of a recurring event
      // We should include it as-is, but we'll need to filter duplicates later
      if (recurrenceInfo.recurrenceId) {
        // This is a modified instance - add it directly with a special ID
        baseEvent.id = `${baseEvent.id}-recurrence-${recurrenceInfo.recurrenceId}`;
        events.push(baseEvent);
      } else if (recurrenceInfo.rrule && baseEvent.start.dateTime) {
        // If there's a RRULE, generate recurring occurrences
        const occurrences = generateRecurringEvents(baseEvent, recurrenceInfo.rrule, recurrenceInfo.exdate || []);
        events.push(...occurrences);
      } else {
        // Single event
        events.push(baseEvent);
      }
      
      currentEvent = null;
      recurrenceInfo = {};
    } else if (currentEvent) {
      if (line.startsWith('UID:')) {
        currentEvent.id = line.substring(4).trim();
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8).trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        let description = line.substring(12).trim();
        // Replace escaped \n with actual newlines in iCal format
        description = description.replace(/\\n/g, '\n');
        currentEvent.description = description;
      } else if (line.startsWith('DTSTART')) {
        const match = line.match(/DTSTART(?:;TZID=([^:]+))?:(.+)/);
        if (match) {
          const tzid = match[1];
          const value = match[2].trim();
          if (value.length === 8) {
            // Date only (YYYYMMDD)
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            currentEvent.start!.date = `${year}-${month}-${day}`;
          } else {
            // DateTime (YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ)
            const dt = parseICalDateTime(value, tzid);
            currentEvent.start!.dateTime = dt.toISOString();
            if (tzid) {
              currentEvent.start!.timeZone = tzid;
            }
          }
        }
      } else if (line.startsWith('DTEND')) {
        const match = line.match(/DTEND(?:;TZID=([^:]+))?:(.+)/);
        if (match) {
          const tzid = match[1];
          const value = match[2].trim();
          if (value.length === 8) {
            // Date only (YYYYMMDD)
            const year = value.substring(0, 4);
            const month = value.substring(4, 6);
            const day = value.substring(6, 8);
            currentEvent.end!.date = `${year}-${month}-${day}`;
          } else {
            // DateTime
            const dt = parseICalDateTime(value, tzid);
            currentEvent.end!.dateTime = dt.toISOString();
            if (tzid) {
              currentEvent.end!.timeZone = tzid;
            }
          }
        }
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9).trim();
      } else if (line.startsWith('URL:')) {
        currentEvent.htmlLink = line.substring(4).trim();
      } else if (line.startsWith('ORGANIZER')) {
        // Format: ORGANIZER;CN=Name:mailto:email@example.com
        const match = line.match(/ORGANIZER(?:;CN=([^:]+))?:(.+)/);
        if (match) {
          const email = match[2].replace(/^mailto:/i, '').trim();
          const displayName = match[1]?.trim();
          if (!currentEvent.organizer) {
            currentEvent.organizer = { email, displayName };
          }
        }
      } else if (line.startsWith('ATTENDEE')) {
        // Format: ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Name:mailto:email@example.com
        // Extract CN (display name), PARTSTAT (response status), and email
        const cnMatch = line.match(/;CN=([^:;]+)/);
        const partstatMatch = line.match(/;PARTSTAT=([^:;]+)/);
        const emailMatch = line.match(/:mailto:([^\s]+)/i) || line.match(/:([^\s@]+@[^\s@]+)/);
        
        if (emailMatch) {
          const email = emailMatch[1].trim();
          const displayName = cnMatch ? cnMatch[1].trim() : undefined;
          const responseStatus = partstatMatch ? partstatMatch[1].trim() : 'NEEDS-ACTION';
          
          if (!currentEvent.attendees) {
            currentEvent.attendees = [];
          }
          currentEvent.attendees.push({
            email,
            displayName,
            responseStatus,
          });
        }
      } else if (line.startsWith('RRULE:')) {
        recurrenceInfo.rrule = line.substring(6).trim();
      } else if (line.startsWith('RECURRENCE-ID')) {
        const match = line.match(/RECURRENCE-ID(?:;TZID=([^:]+))?:(.+)/);
        if (match) {
          recurrenceInfo.recurrenceId = match[2].trim();
        }
      } else if (line.startsWith('EXDATE')) {
        const match = line.match(/EXDATE(?:;TZID=([^:]+))?:(.+)/);
        if (match) {
          if (!recurrenceInfo.exdate) {
            recurrenceInfo.exdate = [];
          }
          recurrenceInfo.exdate.push(match[2].trim());
        }
      } else if (line.startsWith('STATUS:')) {
        recurrenceInfo.status = line.substring(7).trim();
      }
    }
  }
  
  return events;
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
    // Note: JavaScript Date doesn't support arbitrary timezones well, so we'll use local time
    // This is a simplification - for full timezone support, we'd need a library like date-fns-tz
    return new Date(year, month, day, hour, minute, second);
  }
}

// Parse EXDATE to Date objects
function parseExDates(exdates: string[]): Set<string> {
  const excludedDates = new Set<string>();
  for (const exdate of exdates) {
    // EXDATE can be in format YYYYMMDD or YYYYMMDDTHHmmss
    const cleanValue = exdate.replace(/Z$/, '');
    if (cleanValue.length === 8) {
      // Date only
      excludedDates.add(cleanValue);
    } else if (cleanValue.length >= 15) {
      // DateTime - use date part only
      excludedDates.add(cleanValue.substring(0, 8));
    }
  }
  return excludedDates;
}

// Generate recurring events from RRULE
function generateRecurringEvents(
  baseEvent: GoogleCalendarEvent,
  rrule: string,
  exdates: string[]
): GoogleCalendarEvent[] {
  if (!baseEvent.start.dateTime) {
    return [baseEvent]; // Can't generate recurrences without a start time
  }

  const startDate = new Date(baseEvent.start.dateTime);
  const endDate = baseEvent.end?.dateTime ? new Date(baseEvent.end.dateTime) : null;
  const duration = endDate ? endDate.getTime() - startDate.getTime() : 60 * 60 * 1000; // Default 1 hour

  // Parse RRULE
  // Format: FREQ=WEEKLY;WKST=MO;UNTIL=20251215T130000Z;INTERVAL=1;BYDAY=MO
  const params: Record<string, string> = {};
  rrule.split(';').forEach((param) => {
    const [key, value] = param.split('=');
    if (key && value) {
      params[key] = value;
    }
  });

  const freq = params.FREQ;
  const interval = parseInt(params.INTERVAL || '1', 10);
  const until = params.UNTIL ? parseICalDateTime(params.UNTIL) : null;
  const count = params.COUNT ? parseInt(params.COUNT, 10) : null;
  const byday = params.BYDAY ? params.BYDAY.split(',') : null;

  // Parse excluded dates
  const excludedDates = parseExDates(exdates);

  const occurrences: GoogleCalendarEvent[] = [];
  let currentDate = new Date(startDate);
  let occurrenceCount = 0;
  const maxOccurrences = 1000; // Safety limit
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 2); // Limit to 2 years in the future

  // Day of week mapping (iCal uses MO, TU, WE, etc.)
  const dayMap: Record<string, number> = {
    SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
  };

  while (occurrenceCount < maxOccurrences) {
    // Check if we've exceeded the UNTIL date
    if (until && currentDate > until) {
      break;
    }

    // Check if we've exceeded the max date
    if (currentDate > maxDate) {
      break;
    }

    // Check if this date is excluded
    const dateKey = currentDate.toISOString().substring(0, 10).replace(/-/g, '');
    const dateKeyShort = dateKey.substring(0, 8);
    if (!excludedDates.has(dateKeyShort)) {
      // Create occurrence
      const occurrenceStart = new Date(currentDate);
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

      const occurrence: GoogleCalendarEvent = {
        ...baseEvent,
        id: `${baseEvent.id}-${occurrenceCount}`,
        start: {
          dateTime: occurrenceStart.toISOString(),
        },
        end: {
          dateTime: occurrenceEnd.toISOString(),
        },
        // Keep status if it's CANCELLED (for declined events)
        status: baseEvent.status,
        // Keep attendees and organizer for response status detection
        attendees: baseEvent.attendees,
        organizer: baseEvent.organizer,
      };

      occurrences.push(occurrence);
      occurrenceCount++;

      // Check count limit
      if (count && occurrenceCount >= count) {
        break;
      }
    }

    // Calculate next occurrence based on frequency
    if (freq === 'DAILY') {
      currentDate.setDate(currentDate.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      if (byday && byday.length > 0) {
        // Find next occurrence of specified day(s)
        const currentDay = currentDate.getDay();
        const targetDays = byday.map((d) => dayMap[d] ?? -1).filter((d) => d >= 0);
        
        if (targetDays.length > 0) {
          // Find next target day
          let daysToAdd = interval * 7;
          let found = false;
          
          // Check if there's a target day in the current week
          for (const targetDay of targetDays) {
            if (targetDay > currentDay) {
              daysToAdd = targetDay - currentDay;
              found = true;
              break;
            }
          }
          
          // If not found in current week, go to first target day of next interval
          if (!found) {
            daysToAdd = interval * 7 - currentDay + targetDays[0];
          }
          
          currentDate.setDate(currentDate.getDate() + daysToAdd);
        } else {
          currentDate.setDate(currentDate.getDate() + interval * 7);
        }
      } else {
        currentDate.setDate(currentDate.getDate() + interval * 7);
      }
    } else if (freq === 'MONTHLY') {
      currentDate.setMonth(currentDate.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      currentDate.setFullYear(currentDate.getFullYear() + interval);
    } else {
      // Unknown frequency, stop
      break;
    }
  }

  return occurrences;
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
    const startTime = performance.now();
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([cacheKey], (result) => {
        const cached = result[cacheKey];
        if (!cached) {
          console.log('[iCal Cache] Cache miss for', icalUrl.substring(0, 50) + '...');
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
            const loadTime = performance.now() - startTime;
            console.log(`[iCal Cache] Cache hit! Loaded ${events.length} events in ${loadTime.toFixed(2)}ms (cache age: ${Math.round(age / 1000)}s, key: ${cacheKey.substring(0, 20)}...)`);
            resolve({ events, expired: false });
          } else {
            // Cache expired
            if (allowExpired && hasTodayEvents(events)) {
              console.log(`[iCal Cache] Cache expired but has today's events, using stale cache (age: ${Math.round(age / 1000)}s)`);
              resolve({ events, expired: true });
            } else {
              console.log(`[iCal Cache] Cache expired (age: ${Math.round(age / 1000)}s, max: ${Math.round(ICAL_CACHE_DURATION / 1000)}s)`);
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
          console.log('[iCal Cache] Cache miss (localStorage)');
          resolve(null);
          return;
        }
        
        const { events, timestamp } = JSON.parse(cached);
        const now = Date.now();
        const age = now - timestamp;
        
        if (age < ICAL_CACHE_DURATION) {
          const loadTime = performance.now() - startTime;
          console.log(`[iCal Cache] Cache hit (localStorage)! Loaded ${events.length} events in ${loadTime.toFixed(2)}ms`);
          resolve({ events, expired: false });
        } else {
          // Cache expired
          if (allowExpired && hasTodayEvents(events)) {
            console.log(`[iCal Cache] Cache expired but has today's events, using stale cache (localStorage, age: ${Math.round(age / 1000)}s)`);
            resolve({ events, expired: true });
          } else {
            console.log(`[iCal Cache] Cache expired (localStorage, age: ${Math.round(age / 1000)}s)`);
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
  return new Promise((resolve) => {
    const cacheKey = getCacheKey(icalUrl);
    const cacheData = {
      events,
      timestamp: Date.now(),
    };
    
    const saveStartTime = performance.now();
    
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [cacheKey]: JSON.stringify(cacheData) }, () => {
        if (chrome.runtime.lastError) {
          console.error('[iCal Cache] Failed to save to chrome.storage:', chrome.runtime.lastError.message);
        } else {
          const saveTime = performance.now() - saveStartTime;
          console.log(`[iCal Cache] Successfully saved ${events.length} events to cache (key: ${cacheKey.substring(0, 20)}...) in ${saveTime.toFixed(2)}ms`);
        }
        resolve();
      });
    } else {
      // Fallback to localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        const saveTime = performance.now() - saveStartTime;
        console.log(`[iCal Cache] Successfully saved ${events.length} events to localStorage cache in ${saveTime.toFixed(2)}ms`);
        resolve();
      } catch (e) {
        console.error('[iCal Cache] Failed to save cached iCal data to localStorage:', e);
        resolve();
      }
    }
  });
}

// Refresh iCal cache in background (called when using stale cache)
async function refreshICalCache(icalUrl: string): Promise<void> {
  try {
    const response = await fetch(icalUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
      },
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
    const cacheCutoff = todayStart.getTime();
    
    const eventsToCache = allEvents.filter((event) => {
      const eventEnd = event.end?.dateTime || event.end?.date;
      if (!eventEnd) return false;
      
      const endDate = new Date(eventEnd);
      return endDate.getTime() >= cacheCutoff;
    });
    
    await saveCachedICalEvents(icalUrl, eventsToCache);
    console.log(`[iCal Cache] Background refresh completed, cached ${eventsToCache.length} events`);
  } catch (error) {
    console.error('[iCal Cache] Background refresh error:', error);
  }
}

// Fetch events from iCal URL (background refresh if using stale cache)
async function fetchICalEvents(icalUrl: string, period: string): Promise<GoogleCalendarEvent[]> {
  try {
    // Validate URL format
    try {
      new URL(icalUrl);
    } catch {
      throw new Error('Invalid iCal URL format. Please check the URL and try again.');
    }

    // Try to load from cache first (allow expired cache if it has today's events)
    const cachedResult = await loadCachedICalEvents(icalUrl, true);
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
        console.log('[iCal Cache] Cache expired, refreshing in background...');
        // Don't await - refresh in background
        refreshICalCache(icalUrl).catch((err: unknown) => {
          console.error('[iCal Cache] Background refresh failed:', err);
        });
      }
      
      return filteredEvents;
    }

    // Cache miss or expired without today's events, fetch from URL
    const response = await fetch(icalUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
      },
    });
    
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
    
    if (!icalText || icalText.trim().length === 0) {
      throw new Error('The iCal URL returned an empty response. Please verify the URL is correct.');
    }
    
    // Check if it looks like an iCal file
    if (!icalText.includes('BEGIN:VCALENDAR') && !icalText.includes('BEGIN:VEVENT')) {
      throw new Error('The URL does not appear to be a valid iCal file. Please verify the URL points to an .ics file.');
    }
    
    const parseStartTime = performance.now();
    let allEvents = parseICal(icalText);
    const parseTime = performance.now() - parseStartTime;
    console.log(`[iCal] Parsed ${allEvents.length} events in ${parseTime.toFixed(2)}ms`);
    
    // Deduplicate events: if there's a RECURRENCE-ID event, remove the corresponding generated occurrence
    // Events with RECURRENCE-ID have IDs like "uid-recurrence-20251215T140000"
    // Generated occurrences have IDs like "uid-0", "uid-1", etc.
    const recurrenceIdMap = new Map<string, GoogleCalendarEvent>();
    const regularEvents: GoogleCalendarEvent[] = [];
    
    for (const event of allEvents) {
      if (event.id.includes('-recurrence-')) {
        // Extract the base UID and recurrence date from the ID
        const match = event.id.match(/^(.+)-recurrence-(.+)$/);
        if (match) {
          const baseUid = match[1];
          const recurrenceDate = match[2];
          // Use base UID + date as key to match with generated occurrences
          const key = `${baseUid}-${recurrenceDate.substring(0, 8)}`; // Use date part only (YYYYMMDD)
          recurrenceIdMap.set(key, event);
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
        const dateKey = eventDate.toISOString().substring(0, 10).replace(/-/g, ''); // YYYYMMDD
        // Extract base UID (everything before the last dash and number)
        const uidMatch = event.id.match(/^(.+?)-(\d+)$/);
        if (uidMatch) {
          const baseUid = uidMatch[1];
          const key = `${baseUid}-${dateKey}`;
          if (recurrenceIdMap.has(key)) {
            // This occurrence is replaced by a RECURRENCE-ID event, exclude it
            return false;
          }
        }
      }
      return true;
    });
    
    // Add back the RECURRENCE-ID events
    const beforeDedup = allEvents.length;
    allEvents = [...deduplicatedEvents, ...Array.from(recurrenceIdMap.values())];
    console.log(`[iCal] Deduplicated: ${allEvents.length} events (removed ${beforeDedup - allEvents.length} duplicates)`);
    
    // Filter to keep only future events and today's events for cache (to save storage space)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cacheCutoff = todayStart.getTime(); // Keep events from today onwards
    
    const eventsToCache = allEvents.filter((event) => {
      const eventEnd = event.end?.dateTime || event.end?.date;
      if (!eventEnd) return false;
      
      const endDate = new Date(eventEnd);
      // Keep events that haven't ended yet, or ended today or later
      return endDate.getTime() >= cacheCutoff;
    });
    
    console.log(`[iCal Cache] Filtered ${allEvents.length} events to ${eventsToCache.length} events for cache (today + future)`);
    
    // Save to cache (save only future/today events to reduce storage size)
    const saveStartTime = performance.now();
    await saveCachedICalEvents(icalUrl, eventsToCache);
    const saveTime = performance.now() - saveStartTime;
    console.log(`[iCal Cache] Saved ${eventsToCache.length} events to cache in ${saveTime.toFixed(2)}ms`);
    
    // Filter events by period
    const { timeMin, timeMax } = getDateRange(period);
    const timeMinDate = new Date(timeMin);
    const timeMaxDate = new Date(timeMax);
    
    console.log(`[iCal Filter] Filtering events for period "${period}"`);
    console.log(`[iCal Filter] Date range: ${timeMinDate.toLocaleString()} to ${timeMaxDate.toLocaleString()}`);
    console.log(`[iCal Filter] Total events before filtering: ${allEvents.length}`);
    
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
    
    console.log(`[iCal Filter] Events after filtering: ${filteredEvents.length}`);
    
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
  config: GoogleCalendarConfig
): Promise<GoogleCalendarEvent[]> {
  const authType = config.authType || (config.accessToken ? 'oauth' : 'ical');
  
  // Handle iCal URL
  if (authType === 'ical') {
    if (!config.icalUrl) {
      return [];
    }
    return fetchICalEvents(config.icalUrl, config.period);
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
    const startDate = event.start.dateTime || event.start.date;
    if (!startDate) return;

    const date = new Date(startDate);
    // Format date as YYYY-MM-DD in local timezone (not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayKey = `${year}-${month}-${day}`;

    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, []);
    }
    grouped.get(dayKey)!.push(event);
  });

  return grouped;
}

