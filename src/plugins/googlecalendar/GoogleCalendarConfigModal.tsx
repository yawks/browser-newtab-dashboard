import { Calendar, ChevronDown, Link as LinkIcon, LogOut, X } from 'lucide-react';
import { GoogleCalendar, GoogleCalendarAuthType, GoogleCalendarConfig, GoogleCalendarPeriod } from './types';
import { authenticateGoogle, fetchGoogleCalendars, revokeGoogleAuth } from './api';
import { useEffect, useState } from 'react';

import { CacheDurationField } from '@/components/CacheDurationField';
import { createPortal } from 'react-dom';

interface GoogleCalendarConfigModalProps {
  config: GoogleCalendarConfig;
  onSave: (config: GoogleCalendarConfig) => void;
  onClose: () => void;
}

const PERIODS: { id: GoogleCalendarPeriod; label: string }[] = [
  { id: '1-day', label: '1 day' },
  { id: '3-days', label: '3 days' },
  { id: '5-days', label: '5 days' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

export function GoogleCalendarConfigModal({ config, onSave, onClose }: GoogleCalendarConfigModalProps) {
  // Determine auth type: if icalUrl exists, use 'ical', otherwise use 'oauth' or default
  const [authType, setAuthType] = useState<GoogleCalendarAuthType>(
    config?.authType || (config?.icalUrl ? 'ical' : 'oauth')
  );
  const [accessToken, setAccessToken] = useState<string | undefined>(config?.accessToken);
  const [icalUrl, setIcalUrl] = useState<string>(config?.icalUrl || '');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(
    config?.selectedCalendarIds || []
  );
  const [period, setPeriod] = useState<GoogleCalendarPeriod>(config?.period || '1-day');
  const [showPeriodPopover, setShowPeriodPopover] = useState(false);
  const [showAuthTypePopover, setShowAuthTypePopover] = useState(false);
  const [userEmail, setUserEmail] = useState<string>(config?.userEmail || '');
  const [weekStart, setWeekStart] = useState<'monday' | 'sunday'>(config?.weekStart || 'monday');
  const [cacheDuration, setCacheDuration] = useState<number>(config?.cacheDuration ?? 3600);

  // Load calendars when authenticated (OAuth mode only)
  useEffect(() => {
    if (authType === 'oauth' && accessToken) {
      loadCalendars();
    }
  }, [accessToken, authType]);
  
  // Reset OAuth data when switching to iCal
  useEffect(() => {
    if (authType === 'ical') {
      setAccessToken(undefined);
      setCalendars([]);
      setSelectedCalendarIds([]);
    }
  }, [authType]);
  
  // Reset iCal URL when switching to OAuth
  useEffect(() => {
    if (authType === 'oauth') {
      setIcalUrl('');
    }
  }, [authType]);

  const loadCalendars = async () => {
    if (!accessToken) return;
    
    setIsLoadingCalendars(true);
    try {
      const fetchedCalendars = await fetchGoogleCalendars(accessToken);
      setCalendars(fetchedCalendars);
    } catch (error) {
      console.error('Failed to load calendars:', error);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsAuthenticating(true);
    try {
      const { accessToken: token } = await authenticateGoogle();
      setAccessToken(token);
    } catch (error) {
      console.error('Authentication failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Show a more helpful error message
      let userMessage = `Google authentication failed: ${errorMessage}`;
      
      if (errorMessage.includes('OAuth Client ID not configured')) {
        userMessage = `Google authentication failed: OAuth Client ID not configured.\n\n` +
          `For local development, you need to:\n` +
          `1. Create a Google OAuth Client ID (see GOOGLE_CALENDAR_SETUP.md)\n` +
          `2. Set VITE_GOOGLE_CLIENT_ID in your .env file\n` +
          `3. Rebuild the extension (npm run build)\n\n` +
          `This is a one-time setup that takes about 5 minutes.`;
      } else if (errorMessage.includes('Invalid oauth2 client ID')) {
        userMessage = `Google authentication failed: Invalid OAuth Client ID.\n\n` +
          `Please check:\n` +
          `- The Client ID in your .env file is correct\n` +
          `- The redirect URI in Google Cloud Console matches: https://YOUR_EXTENSION_ID.chromiumapp.org/\n` +
          `- You rebuilt the extension after setting the Client ID\n\n` +
          `See GOOGLE_CALENDAR_SETUP.md for help.`;
      }
      
      alert(userMessage);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRevokeAuth = async () => {
    try {
      await revokeGoogleAuth();
      setAccessToken(undefined);
      setCalendars([]);
      setSelectedCalendarIds([]);
    } catch (error) {
      console.error('Failed to revoke auth:', error);
    }
  };

  const handleCalendarToggle = (calendarId: string) => {
    setSelectedCalendarIds((prev) => {
      if (prev.includes(calendarId)) {
        return prev.filter((id) => id !== calendarId);
      } else {
        return [...prev, calendarId];
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (authType === 'oauth') {
      if (!accessToken) {
        alert('Please authenticate with Google first.');
        return;
      }

      if (selectedCalendarIds.length === 0) {
        alert('Please select at least one calendar.');
        return;
      }

      const newConfig: GoogleCalendarConfig = {
        authType: 'oauth',
        accessToken,
        selectedCalendarIds,
        period,
        userEmail: userEmail.trim() || undefined,
        weekStart,
        cacheDuration,
      };

      onSave(newConfig);
    } else {
      // iCal mode
      if (!icalUrl.trim()) {
        alert('Please enter an iCal URL.');
        return;
      }

      // Validate URL
      try {
        new URL(icalUrl.trim());
      } catch {
        alert('Please enter a valid URL.');
        return;
      }

      const newConfig: GoogleCalendarConfig = {
        authType: 'ical',
        icalUrl: icalUrl.trim(),
        period,
        userEmail: userEmail.trim() || undefined,
        weekStart,
        cacheDuration,
      };

      onSave(newConfig);
    }
  };

  const periodLabel = PERIODS.find((p) => p.id === period)?.label || period;

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.popover-container')) {
        setShowPeriodPopover(false);
        setShowAuthTypePopover(false);
      }
    };

    if (showPeriodPopover || showAuthTypePopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPeriodPopover, showAuthTypePopover]);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Configure Google Calendar
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Authentication Type Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Calendar Source
            </label>
            <div className="relative popover-container">
              <button
                type="button"
                onClick={() => setShowAuthTypePopover((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
              >
                <span>
                  {authType === 'oauth' ? 'Google Calendar (OAuth)' : 'Public iCal URL'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showAuthTypePopover && (
                <div
                  className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAuthType('oauth');
                      setShowAuthTypePopover(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                  >
                    Google Calendar (OAuth)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthType('ical');
                      setShowAuthTypePopover(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                  >
                    Public iCal URL
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* OAuth Authentication */}
          {authType === 'oauth' && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Google Authentication
              </label>
              {!accessToken ? (
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isAuthenticating}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAuthenticating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  <span>Connected to Google</span>
                </div>
                <button
                  type="button"
                  onClick={handleRevokeAuth}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
            </div>
          )}

          {/* iCal URL Input */}
          {authType === 'ical' && (
            <>
              <div>
                <label htmlFor="icalUrl" className="text-sm font-medium mb-2 block">
                  Public iCal URL
                </label>
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    id="icalUrl"
                    type="url"
                    value={icalUrl}
                    onChange={(e) => setIcalUrl(e.target.value)}
                    placeholder="https://calendar.google.com/calendar/ical/..."
                    className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the public iCal URL of your calendar. Most calendar services provide a public iCal feed URL.
                </p>
              </div>
              <div>
                <label htmlFor="userEmail" className="text-sm font-medium mb-2 block">
                  Your Email Address
                </label>
                <input
                  type="email"
                  id="userEmail"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="your.email@example.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your email address to correctly identify your response status in events. This must match the email used in your calendar.
                </p>
              </div>
            </>
          )}

          {/* Calendar Selection (OAuth only) */}
          {authType === 'oauth' && accessToken && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Calendars to display
              </label>
              {isLoadingCalendars ? (
                <div className="text-sm text-muted-foreground">Loading calendars...</div>
              ) : calendars.length === 0 ? (
                <div className="text-sm text-muted-foreground">No calendars found.</div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-input rounded-md p-2 space-y-2">
                  {calendars.map((calendar) => (
                    <label
                      key={calendar.id}
                      className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCalendarIds.includes(calendar.id)}
                        onChange={() => handleCalendarToggle(calendar.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{calendar.summary}</div>
                        {calendar.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {calendar.description}
                          </div>
                        )}
                      </div>
                      {calendar.backgroundColor && (
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: calendar.backgroundColor }}
                        />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Period Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Period</label>
            <div className="relative popover-container">
              <button
                type="button"
                onClick={() => setShowPeriodPopover((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
              >
                <span>{periodLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showPeriodPopover && (
                <div
                  className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {PERIODS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setPeriod(option.id);
                        setShowPeriodPopover(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Week starts on</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="weekStart"
                  checked={weekStart === 'monday'}
                  onChange={() => setWeekStart('monday')}
                />
                <span className="text-sm">Monday</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="weekStart"
                  checked={weekStart === 'sunday'}
                  onChange={() => setWeekStart('sunday')}
                />
                <span className="text-sm">Sunday</span>
              </label>
            </div>
          </div>

          <CacheDurationField
            value={cacheDuration}
            onChange={setCacheDuration}
          />

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                authType === 'oauth' 
                  ? (!accessToken || selectedCalendarIds.length === 0)
                  : !icalUrl.trim()
              }
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}

