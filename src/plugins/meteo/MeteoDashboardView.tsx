import { useEffect, useRef, useState } from 'react';
import { PluginComponentProps } from '@/types/plugin';
import { MeteoConfig, MeteoWeatherData } from './types';
import { fetchMeteoData } from './api';
import { AlertCircle, Loader2 } from 'lucide-react';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function MeteoDashboardView({ config }: PluginComponentProps) {
  const meteoConfig = (config as unknown as MeteoConfig) || {
    provider: 'openweather',
    apiKey: '',
  };

  const [weather, setWeather] = useState<MeteoWeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [currentSectionHeight, setCurrentSectionHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadWeather = async () => {
      if (!meteoConfig.apiKey || !meteoConfig.latitude || !meteoConfig.longitude) {
        setError('Please configure the weather widget (API key and city).');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchMeteoData(meteoConfig);
        setWeather(data);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch weather. Check your API key and city.');
      } finally {
        setIsLoading(false);
      }
    };

    loadWeather();

    const interval = setInterval(loadWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [meteoConfig.apiKey, meteoConfig.latitude, meteoConfig.longitude, meteoConfig.provider, meteoConfig.cityName]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initial measurement
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    // Initial measurement after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(updateDimensions, 0);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [weather]);

  useEffect(() => {
    if (!currentSectionRef.current) return;

    // Initial measurement
    const updateHeight = () => {
      if (currentSectionRef.current) {
        setCurrentSectionHeight(currentSectionRef.current.offsetHeight);
      }
    };

    // Initial measurement after a short delay
    const timeoutId = setTimeout(updateHeight, 0);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { height } = entry.contentRect;
      setCurrentSectionHeight(height);
    });

    observer.observe(currentSectionRef.current);
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [weather]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center text-sm text-muted-foreground">
        <AlertCircle className="w-6 h-6 text-destructive mb-2" />
        <p>{error || 'Weather data unavailable.'}</p>
      </div>
    );
  }

  const currentIcon = `https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`;
  const measuredWidth = dimensions.width || containerRef.current?.offsetWidth || 0;
  const measuredHeight = dimensions.height || containerRef.current?.offsetHeight || 0;
  const maxDays =
    measuredWidth <= 0
      ? 0
      : measuredWidth < 320
      ? 1
      : measuredWidth < 480
      ? 2
      : measuredWidth < 640
      ? 3
      : measuredWidth < 820
      ? 4
      : 5;
  const forecastDays = weather.forecast.slice(0, maxDays);
  const forecastMinHeight = 140;
  // Calculate available height for forecast
  // If dimensions are not yet measured, assume we have space (will be recalculated when measured)
  const availableForecastHeight = measuredHeight > 0 && currentSectionHeight > 0
    ? Math.max(measuredHeight - currentSectionHeight - 24, 0)
    : 999; // Large value to show forecast by default until measured
  const showForecast =
    forecastDays.length > 0 && measuredWidth > 240 && availableForecastHeight >= forecastMinHeight;

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      {/* Current weather */}
      <div
        ref={currentSectionRef}
        className="flex flex-wrap md:flex-nowrap items-center gap-4 p-4 bg-gradient-to-r from-sky-500/10 to-sky-200/10 rounded-lg border border-border flex-shrink-0"
      >
        <img src={currentIcon} alt={weather.current.description} className="w-20 h-20" />
        <div>
          <div className="text-4xl font-bold">
            {Math.round(weather.current.temperature)}
            <span className="text-2xl align-top">°C</span>
          </div>
          <div className="text-sm capitalize text-muted-foreground">{weather.current.description}</div>
          <div className="text-xs text-muted-foreground">
            Min {Math.round(weather.current.minTemperature)}°C · Max {Math.round(weather.current.maxTemperature)}°C
          </div>
          <div className="text-xs text-muted-foreground">
            Feels like {Math.round(weather.current.feelsLike)}°C · Humidity {weather.current.humidity}% · Wind{' '}
            {Math.round(weather.current.windSpeed)} m/s
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-sm font-semibold">{weather.cityName}</div>
          <div className="text-xs text-muted-foreground">{weather.country}</div>
        </div>
      </div>

      {/* Forecast */}
      {showForecast && (
        <div
          className="grid gap-2 overflow-hidden flex-shrink-0 mt-auto"
          style={{ gridTemplateColumns: `repeat(${forecastDays.length}, minmax(0, 1fr))` }}
        >
          {forecastDays.map((day) => (
            <div
              key={day.date}
              className="p-2 border border-border rounded-md flex flex-col items-center text-xs bg-card/40"
            >
              <div className="text-[11px] text-muted-foreground mb-1 font-medium">
                {formatDate(day.date)}
              </div>
              <img
                src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                alt={day.description}
                className="w-10 h-10"
              />
              <div className="mt-1 font-medium capitalize text-center">{day.description}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {Math.round(day.minTemperature)}°C · {Math.round(day.maxTemperature)}°C
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

