import { ChevronDown, Clock, X } from 'lucide-react';
import { ClockConfig, ClockFormat, ClockTheme } from './types';

import { createPortal } from 'react-dom';
import { getSystemTimezone } from './api';
import { useState } from 'react';
import {ClockView} from './ClockView';

const THEMES: { id: ClockTheme; label: string; category: 'digital' | 'analog' }[] = [
  { id: 'digital-simple', label: 'Digital Simple', category: 'digital' },
  { id: 'digital-modern', label: 'Digital Modern', category: 'digital' },
  { id: 'digital-neon', label: 'Digital Neon', category: 'digital' },
  { id: 'digital-minimal', label: 'Digital Minimal', category: 'digital' },
  { id: 'analog-classic', label: 'Analog Classic', category: 'analog' },
  { id: 'analog-modern', label: 'Analog Modern', category: 'analog' },
  { id: 'analog-minimal', label: 'Analog Minimal', category: 'analog' },
];

const COMMON_TIMEZONES = [
  { value: '', label: 'System Default' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'America/Toronto (EST/EDT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT/AEST)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZDT/NZST)' },
];

interface ClockConfigModalProps {
  config: ClockConfig;
  onSave: (config: ClockConfig) => void;
  onClose: () => void;
}

export function ClockConfigModal({ config, onSave, onClose }: ClockConfigModalProps) {
  const [theme, setTheme] = useState<ClockTheme>(config.theme || 'digital-simple');
  const [timezone, setTimezone] = useState<string>(config.timezone || '');
  const [showDate, setShowDate] = useState(config.showDate !== false);
  const [format, setFormat] = useState<ClockFormat>(config.format || '24h');
  const [showSunrise, setShowSunrise] = useState(config.showSunrise || false);
  const [showSunset, setShowSunset] = useState(config.showSunset || false);
  const [latitude, setLatitude] = useState<string>(config.latitude?.toString() || '');
  const [longitude, setLongitude] = useState<string>(config.longitude?.toString() || '');
  const [showThemePopover, setShowThemePopover] = useState(false);
  const [showTimezonePopover, setShowTimezonePopover] = useState(false);
  const [customTimezone, setCustomTimezone] = useState<string>('');

  const systemTimezone = getSystemTimezone();

  const validateCoordinates = (): { lat?: number; lng?: number; error?: string } => {
    if (!showSunrise && !showSunset) {
      return {};
    }

    if (!latitude || !longitude) {
      return { error: 'Please provide latitude and longitude to display sun times.' };
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return { error: 'Please provide valid latitude and longitude values.' };
    }

    const isValidLat = lat >= -90 && lat <= 90;
    const isValidLng = lng >= -180 && lng <= 180;
    if (!isValidLat || !isValidLng) {
      return { error: 'Latitude must be between -90 and 90, longitude between -180 and 180.' };
    }

    return { lat, lng };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateCoordinates();
    if (validation.error) {
      alert(validation.error);
      return;
    }

    onSave({
      theme,
      timezone: timezone || undefined,
      showDate,
      format,
      showSunrise,
      showSunset,
      latitude: validation.lat,
      longitude: validation.lng,
    });
  };

  const themeLabel = THEMES.find((t) => t.id === theme)?.label || theme;
  const timezoneLabel = timezone 
    ? COMMON_TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone
    : `System Default (${systemTimezone})`;

  const digitalThemes = THEMES.filter((t) => t.category === 'digital');
  const analogThemes = THEMES.filter((t) => t.category === 'analog');

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Configure Clock Widget
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preview */}
          <div>
          <label className='text-sm font-medium block mb-2'>Preview</label>
            <div className='border border-border rounded-lg mb-2'>
              <ClockView clockConfig={{
                theme,
                timezone: timezone || undefined,
                showDate,
                format,
                showSunrise,
                showSunset,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
              }}/>
            </div>
          </div>

          {/* Theme Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Theme</label>
            <div className="relative popover-container">
              <button
                type="button"
                onClick={() => setShowThemePopover((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
              >
                <span>{themeLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showThemePopover && (
                <div
                  className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="p-2">
                    <div className="text-xs font-semibold text-muted-foreground px-2 py-1">Digital</div>
                    {digitalThemes.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setTheme(option.id);
                          setShowThemePopover(false);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded"
                      >
                        {option.label}
                      </button>
                    ))}
                    <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-2">Analog</div>
                    {analogThemes.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setTheme(option.id);
                          setShowThemePopover(false);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timezone Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Timezone</label>
            <div className="relative popover-container">
              <button
                type="button"
                onClick={() => setShowTimezonePopover((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
              >
                <span className="truncate">{timezoneLabel}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              </button>
              {showTimezonePopover && (
                <div
                  className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {COMMON_TIMEZONES.map((option) => (
                    <button
                      key={option.value || 'system'}
                      type="button"
                      onClick={() => {
                        setTimezone(option.value);
                        setShowTimezonePopover(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-accent"
                    >
                      {option.label}
                    </button>
                  ))}
                  <div className="border-t border-border p-2">
                    <input
                      type="text"
                      value={customTimezone}
                      onChange={(e) => setCustomTimezone(e.target.value)}
                      placeholder="Custom timezone (e.g., Europe/Paris)"
                      className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customTimezone.trim()) {
                            setTimezone(customTimezone.trim());
                            setCustomTimezone('');
                            setShowTimezonePopover(false);
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            {timezone && (
              <p className="text-xs text-muted-foreground mt-1">
                Current: {timezone}
              </p>
            )}
          </div>

          {/* Date Display */}
          <div className="flex items-center justify-between">
            <label htmlFor="showDate" className="text-sm font-medium">
              Show Date
            </label>
            <input
              id="showDate"
              type="checkbox"
              checked={showDate}
              onChange={(e) => setShowDate(e.target.checked)}
              className="w-4 h-4"
            />
          </div>

          {/* Time Format */}
          <div>
            <label className="text-sm font-medium mb-2 block">Time Format</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormat('24h')}
                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                  format === '24h'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-input hover:bg-accent'
                }`}
              >
                24 Hours
              </button>
              <button
                type="button"
                onClick={() => setFormat('12h')}
                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                  format === '12h'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-input hover:bg-accent'
                }`}
              >
                12 Hours (AM/PM)
              </button>
            </div>
          </div>

          {/* Sun Times Section */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="text-sm font-medium">Sun Times</div>
            
            <div className="flex items-center justify-between">
              <label htmlFor="showSunrise" className="text-sm">
                Show Sunrise
              </label>
              <input
                id="showSunrise"
                type="checkbox"
                checked={showSunrise}
                onChange={(e) => setShowSunrise(e.target.checked)}
                className="w-4 h-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="showSunset" className="text-sm">
                Show Sunset
              </label>
              <input
                id="showSunset"
                type="checkbox"
                checked={showSunset}
                onChange={(e) => setShowSunset(e.target.checked)}
                className="w-4 h-4"
              />
            </div>

            {(showSunrise || showSunset) && (
              <div className="space-y-2 pt-2">
                <div>
                  <label htmlFor="latitude" className="text-sm font-medium mb-1 block">
                    Latitude
                  </label>
                  <input
                    id="latitude"
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g., 48.8566"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="longitude" className="text-sm font-medium mb-1 block">
                    Longitude
                  </label>
                  <input
                    id="longitude"
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g., 2.3522"
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required to calculate sun times. You can find coordinates using online tools.
                  </p>
                </div>
              </div>
            )}
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
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Render modal using portal to escape any overflow constraints
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
}

