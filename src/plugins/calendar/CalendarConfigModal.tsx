import { Calendar, ChevronDown, Link as LinkIcon, LogOut, Plus, Trash2, X } from 'lucide-react';
import { CalendarConfig, CalendarPeriod, CalendarSource, CalendarSourceType, GoogleCalendarMeta } from './types';
import { authenticateGoogle, fetchGoogleCalendars, revokeGoogleAuth } from './api';
import { useEffect, useState } from 'react';

import { CacheDurationField } from '@/components/CacheDurationField';
import { createPortal } from 'react-dom';

interface CalendarConfigModalProps {
  config: CalendarConfig;
  onSave: (config: CalendarConfig) => void;
  onClose: () => void;
}

const PERIODS: { id: CalendarPeriod; label: string }[] = [
  { id: '1-day', label: '1 day' },
  { id: '3-days', label: '3 days' },
  { id: '5-days', label: '5 days' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function generateSourceId(): string {
  return `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Sub-component: form to add a new source
interface AddSourceFormProps {
  onAdd: (source: CalendarSource) => void;
  onCancel: () => void;
}

function AddSourceForm({ onAdd, onCancel }: AddSourceFormProps) {
  const [sourceType, setSourceType] = useState<CalendarSourceType>('ical');
  const [showTypePopover, setShowTypePopover] = useState(false);

  // OAuth state
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendarMeta[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  // iCal state
  const [icalUrl, setIcalUrl] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    if (sourceType === 'oauth' && accessToken) {
      setIsLoadingCalendars(true);
      fetchGoogleCalendars(accessToken)
        .then(setCalendars)
        .catch((err) => console.error('Failed to load calendars:', err))
        .finally(() => setIsLoadingCalendars(false));
    }
  }, [accessToken, sourceType]);

  const handleGoogleAuth = async () => {
    setIsAuthenticating(true);
    try {
      const { accessToken: token } = await authenticateGoogle();
      setAccessToken(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let userMessage = `Google authentication failed: ${errorMessage}`;
      if (errorMessage.includes('OAuth Client ID not configured')) {
        userMessage =
          'Google authentication failed: OAuth Client ID not configured.\n\n' +
          'Set VITE_GOOGLE_CLIENT_ID in your .env file and rebuild the extension.\n\n' +
          'See GOOGLE_CALENDAR_SETUP.md for detailed instructions.';
      }
      alert(userMessage);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCalendarToggle = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId) ? prev.filter((id) => id !== calendarId) : [...prev, calendarId]
    );
  };

  const handleAdd = () => {
    if (sourceType === 'oauth') {
      if (!accessToken) {
        alert('Please authenticate with Google first.');
        return;
      }
      if (selectedCalendarIds.length === 0) {
        alert('Please select at least one calendar.');
        return;
      }
      onAdd({
        id: generateSourceId(),
        type: 'oauth',
        accessToken,
        selectedCalendarIds,
        userEmail: userEmail.trim() || undefined,
      });
    } else {
      if (!icalUrl.trim()) {
        alert('Please enter an iCal URL.');
        return;
      }
      try {
        new URL(icalUrl.trim());
      } catch {
        alert('Please enter a valid URL.');
        return;
      }
      onAdd({
        id: generateSourceId(),
        type: 'ical',
        icalUrl: icalUrl.trim(),
        userEmail: userEmail.trim() || undefined,
      });
    }
  };

  const canAdd =
    sourceType === 'oauth' ? !!accessToken && selectedCalendarIds.length > 0 : !!icalUrl.trim();

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="text-sm font-medium">New source</div>

      {/* Type selector */}
      <div className="relative popover-container">
        <button
          type="button"
          onClick={() => setShowTypePopover((prev) => !prev)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent text-sm"
        >
          <span>{sourceType === 'oauth' ? 'Google Calendar (OAuth)' : 'Public iCal URL'}</span>
          <ChevronDown className="w-4 h-4" />
        </button>
        {showTypePopover && (
          <div
            className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => { setSourceType('oauth'); setShowTypePopover(false); }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
            >
              Google Calendar (OAuth)
            </button>
            <button
              type="button"
              onClick={() => { setSourceType('ical'); setShowTypePopover(false); }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
            >
              Public iCal URL
            </button>
          </div>
        )}
      </div>

      {/* OAuth */}
      {sourceType === 'oauth' && (
        <>
          {!accessToken ? (
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isAuthenticating}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isAuthenticating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Sign in with Google</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <span className="text-sm text-green-700 dark:text-green-300">Connected to Google</span>
              <button
                type="button"
                onClick={() => { revokeGoogleAuth(); setAccessToken(undefined); setCalendars([]); setSelectedCalendarIds([]); }}
                className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          )}

          {accessToken && (
            <div>
              <label className="text-sm font-medium mb-1 block">Calendars to display</label>
              {isLoadingCalendars ? (
                <div className="text-sm text-muted-foreground">Loading calendars...</div>
              ) : calendars.length === 0 ? (
                <div className="text-sm text-muted-foreground">No calendars found.</div>
              ) : (
                <div className="max-h-40 overflow-y-auto border border-input rounded-md p-2 space-y-1">
                  {calendars.map((calendar) => (
                    <label key={calendar.id} className="flex items-center gap-2 p-1.5 hover:bg-accent rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCalendarIds.includes(calendar.id)}
                        onChange={() => handleCalendarToggle(calendar.id)}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{calendar.summary}</div>
                      </div>
                      {calendar.backgroundColor && (
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: calendar.backgroundColor }} />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Your email (optional, for RSVP status)</label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background"
            />
          </div>
        </>
      )}

      {/* iCal */}
      {sourceType === 'ical' && (
        <>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Public iCal URL</label>
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="url"
                value={icalUrl}
                onChange={(e) => setIcalUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/..."
                className="flex-1 px-3 py-1.5 text-sm border border-input rounded-md bg-background"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Your email (optional, for RSVP status)</label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your.email@example.com"
              className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background"
            />
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Summary of a configured source
function SourceSummary({ source }: { source: CalendarSource }) {
  if (source.type === 'oauth') {
    const count = source.selectedCalendarIds?.length ?? 0;
    return (
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-4 h-4 flex-shrink-0 text-blue-500" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <div className="min-w-0">
          <div className="text-sm font-medium">Google Calendar (OAuth)</div>
          <div className="text-xs text-muted-foreground">{count} calendar{count !== 1 ? 's' : ''} selected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <LinkIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-sm font-medium">iCal</div>
        <div className="text-xs text-muted-foreground truncate max-w-[220px]">{source.icalUrl}</div>
      </div>
    </div>
  );
}

export function CalendarConfigModal({ config, onSave, onClose }: CalendarConfigModalProps) {
  const [sources, setSources] = useState<CalendarSource[]>(config.sources || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [period, setPeriod] = useState<CalendarPeriod>(config.period || '1-day');
  const [showPeriodPopover, setShowPeriodPopover] = useState(false);
  const [weekStart, setWeekStart] = useState<'monday' | 'sunday'>(config.weekStart || 'monday');
  const [cacheDuration, setCacheDuration] = useState<number>(config.cacheDuration ?? 3600);

  const handleAddSource = (source: CalendarSource) => {
    setSources((prev) => [...prev, source]);
    setShowAddForm(false);
  };

  const handleRemoveSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (sources.length === 0) {
      alert('Please add at least one calendar source.');
      return;
    }

    onSave({
      sources,
      period,
      weekStart,
      cacheDuration,
    });
  };

  const periodLabel = PERIODS.find((p) => p.id === period)?.label || period;

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
            Configure Calendar
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Calendar Sources */}
          <div>
            <label className="text-sm font-medium mb-2 block">Calendar Sources</label>

            {sources.length === 0 && !showAddForm && (
              <p className="text-sm text-muted-foreground mb-2">No sources configured yet.</p>
            )}

            {sources.length > 0 && (
              <div className="space-y-2 mb-2">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between gap-2 p-3 border border-input rounded-md bg-background"
                  >
                    <SourceSummary source={source} />
                    <button
                      type="button"
                      onClick={() => handleRemoveSource(source.id)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0 ml-2"
                      title="Remove source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddForm ? (
              <AddSourceForm
                onAdd={handleAddSource}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-input rounded-md hover:bg-accent w-full justify-center text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
                Add a source
              </button>
            )}
          </div>

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

          <CacheDurationField value={cacheDuration} onChange={setCacheDuration} />

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
              disabled={sources.length === 0}
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
