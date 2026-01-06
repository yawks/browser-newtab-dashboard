import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MeteoConfig, MeteoCitySuggestion, MeteoProvider } from './types';
import { searchCities } from './api';
import { X, CloudSun, ChevronDown } from 'lucide-react';
import { CacheDurationField } from '@/components/CacheDurationField';

const PROVIDERS: { id: MeteoProvider; label: string }[] = [
  { id: 'openweather', label: 'OpenWeatherMap' },
];

interface MeteoConfigModalProps {
  config: MeteoConfig;
  onSave: (config: MeteoConfig) => void;
  onClose: () => void;
}

export function MeteoConfigModal({ config, onSave, onClose }: MeteoConfigModalProps) {
  const [provider, setProvider] = useState<MeteoProvider>(config.provider || 'openweather');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [cityQuery, setCityQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<MeteoCitySuggestion | null>(
    config.latitude && config.longitude && config.cityName
      ? {
          name: config.cityName,
          country: config.country || '',
          lat: config.latitude,
          lon: config.longitude,
        }
      : null
  );
  const [suggestions, setSuggestions] = useState<MeteoCitySuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProviderPopover, setShowProviderPopover] = useState(false);
  const [cacheDuration, setCacheDuration] = useState<number>(config.cacheDuration ?? 3600);

  useEffect(() => {
    if (!cityQuery || cityQuery.length < 2 || !apiKey) {
      setSuggestions([]);
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const results = await searchCities(provider, apiKey, cityQuery);
        if (!isCancelled) {
          setSuggestions(results);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('City search failed', err);
          setError('Failed to search cities. Check your API key.');
          setSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [cityQuery, apiKey, provider]);

  const providerLabel = useMemo(
    () => PROVIDERS.find((item) => item.id === provider)?.label ?? provider,
    [provider]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !selectedCity) {
      setError('Please provide an API key and select a city.');
      return;
    }

    onSave({
      provider,
      apiKey: apiKey.trim(),
      cityName: selectedCity.name,
      country: selectedCity.country,
      latitude: selectedCity.lat,
      longitude: selectedCity.lon,
      cacheDuration,
    });
  };

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
            <CloudSun className="w-5 h-5" />
            Configure Weather Widget
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Provider</label>
            <div className="relative popover-container">
              <button
                type="button"
                onClick={() => setShowProviderPopover((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent"
              >
                <span>{providerLabel}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {showProviderPopover && (
                <div
                  className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {PROVIDERS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setProvider(option.id);
                        setShowProviderPopover(false);
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
            <label htmlFor="apiKey" className="text-sm font-medium mb-2 block">
              API Key
            </label>
            <input
              id="apiKey"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your provider API key"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              You can create a free API key on the provider's website.
            </p>
          </div>

          <div>
            <label htmlFor="city" className="text-sm font-medium mb-2 block">
              City
            </label>
            <input
              id="city"
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Search for a city"
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            />
            {isSearching && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            {suggestions.length > 0 && (
              <div className="mt-2 border border-border rounded-md max-h-48 overflow-y-auto bg-card">
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.name}-${suggestion.lat}-${suggestion.lon}`}
                    type="button"
                    onClick={() => {
                      setSelectedCity(suggestion);
                      setCityQuery(`${suggestion.name}, ${suggestion.country}`);
                      setSuggestions([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                  >
                    {suggestion.name}
                    {suggestion.state ? `, ${suggestion.state}` : ''}, {suggestion.country}
                  </button>
                ))}
              </div>
            )}
            {selectedCity && (
              <p className="text-xs text-muted-foreground mt-1">
                Selected: {selectedCity.name}
                {selectedCity.state ? `, ${selectedCity.state}` : ''}, {selectedCity.country}
              </p>
            )}
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
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
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

