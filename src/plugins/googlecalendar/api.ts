import { GoogleCalendarConfig, GoogleCalendar, GoogleCalendarEventsResponse, GoogleCalendarEvent } from './types';

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

// Fetch list of calendars
export async function fetchGoogleCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const response = await fetch(GOOGLE_CALENDAR_LIST_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
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
  timeMax.setDate(timeMax.getDate() + days);
  timeMax.setHours(23, 59, 59, 999);

  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  };
}

// Fetch events for selected calendars
export async function fetchGoogleCalendarEvents(
  config: GoogleCalendarConfig
): Promise<GoogleCalendarEvent[]> {
  if (!config.accessToken || !config.selectedCalendarIds || config.selectedCalendarIds.length === 0) {
    return [];
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

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

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

