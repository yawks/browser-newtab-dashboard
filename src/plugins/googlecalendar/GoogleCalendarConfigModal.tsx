import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GoogleCalendarConfig, GoogleCalendarPeriod, GoogleCalendar } from './types';
import { X, Calendar, ChevronDown, LogOut } from 'lucide-react';
import { authenticateGoogle, revokeGoogleAuth, fetchGoogleCalendars } from './api';

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
];

export function GoogleCalendarConfigModal({ config, onSave, onClose }: GoogleCalendarConfigModalProps) {
  const [accessToken, setAccessToken] = useState<string | undefined>(config?.accessToken);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(
    config?.selectedCalendarIds || []
  );
  const [period, setPeriod] = useState<GoogleCalendarPeriod>(config?.period || '1-day');
  const [showPeriodPopover, setShowPeriodPopover] = useState(false);

  // Load calendars when authenticated
  useEffect(() => {
    if (accessToken) {
      loadCalendars();
    }
  }, [accessToken]);

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
    
    if (!accessToken) {
      alert('Please authenticate with Google first.');
      return;
    }

    if (selectedCalendarIds.length === 0) {
      alert('Please select at least one calendar.');
      return;
    }

    const newConfig: GoogleCalendarConfig = {
      accessToken,
      selectedCalendarIds,
      period,
    };

    onSave(newConfig);
  };

  const periodLabel = PERIODS.find((p) => p.id === period)?.label || period;

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.popover-container')) {
        setShowPeriodPopover(false);
      }
    };

    if (showPeriodPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPeriodPopover]);

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
          {/* Google Authentication */}
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

          {/* Calendar Selection */}
          {accessToken && (
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
              disabled={!accessToken || selectedCalendarIds.length === 0}
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

