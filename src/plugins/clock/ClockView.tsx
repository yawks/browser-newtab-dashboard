import { fetchSunTimes, getSystemTimezone, getTimezoneDisplayName } from './api';
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Sunrise, Sunset } from 'lucide-react';
import { ClockConfig, SunTimes } from './types';

// Digital clock components
function DigitalSimple({ time, date, timezone }: { time: string; date: string; timezone?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="text-6xl md:text-7xl font-mono font-bold tracking-tighter">
        {time}
      </div>
      {date && (
        <div className="text-sm text-muted-foreground mt-2">{date}</div>
      )}
      {timezone && (
        <div className="text-xs text-muted-foreground mt-1">{timezone}</div>
      )}
    </div>
  );
}

function DigitalModern({ time, date, timezone }: { time: string; date: string; timezone?: string }) {
  const [hours, minutes, seconds, ampm] = time.split(/[: ]/);
  
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="flex items-baseline gap-2">
        <div className="text-7xl md:text-8xl font-bold">{hours}</div>
        <div className="text-5xl md:text-6xl font-light text-muted-foreground">:</div>
        <div className="text-7xl md:text-8xl font-bold">{minutes}</div>
        {seconds && (
          <>
            <div className="text-4xl md:text-5xl font-light text-muted-foreground">:</div>
            <div className="text-5xl md:text-6xl font-light text-muted-foreground">{seconds}</div>
          </>
        )}
        {ampm && (
          <div className="text-2xl md:text-3xl font-medium text-muted-foreground ml-2">{ampm}</div>
        )}
      </div>
      {date && (
        <div className="text-sm text-muted-foreground mt-4">{date}</div>
      )}
      {timezone && (
        <div className="text-xs text-muted-foreground mt-1">{timezone}</div>
      )}
    </div>
  );
}

function DigitalNeon({ time, date, timezone }: { time: string; date: string; timezone?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="text-6xl md:text-7xl font-mono font-bold tracking-tighter text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
        {time}
      </div>
      {date && (
        <div className="text-sm text-cyan-300/70 mt-2">{date}</div>
      )}
      {timezone && (
        <div className="text-xs text-cyan-300/50 mt-1">{timezone}</div>
      )}
    </div>
  );
}

function DigitalMinimal({ time, date, timezone }: { time: string; date: string; timezone?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="text-5xl md:text-6xl font-light tracking-wider">
        {time}
      </div>
      {date && (
        <div className="text-xs text-muted-foreground mt-3 tracking-wider uppercase">{date}</div>
      )}
      {timezone && (
        <div className="text-xs text-muted-foreground mt-1">{timezone}</div>
      )}
    </div>
  );
}

// Analog clock component
function AnalogClock({ 
  hours,
  minutes,
  seconds,
  date, 
  timezone, 
  theme 
}: { 
  hours: number;
  minutes: number;
  seconds: number;
  date: string; 
  timezone?: string;
  theme: 'analog-classic' | 'analog-modern' | 'analog-minimal';
}) {
  const hourAngle = (hours * 30) + (minutes * 0.5);
  const minuteAngle = minutes * 6;
  const secondAngle = seconds * 6;
  
  const isClassic = theme === 'analog-classic';
  const isModern = theme === 'analog-modern';
  const isMinimal = theme === 'analog-minimal';

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 gap-4">
      <div className="relative" style={{ width: 'min(200px, 80%)', aspectRatio: '1' }}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Clock face */}
          <circle
            cx="100"
            cy="100"
            r="95"
            fill={isMinimal ? 'transparent' : isClassic ? '#f8f9fa' : '#1a1a1a'}
            stroke={isClassic ? '#333' : isModern ? '#444' : 'currentColor'}
            strokeWidth={isMinimal ? '1' : '2'}
            className={isMinimal ? 'text-border' : ''}
          />
          
          {/* Hour markers */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30) - 90;
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + 80 * Math.cos(rad);
            const y1 = 100 + 80 * Math.sin(rad);
            const x2 = 100 + 90 * Math.cos(rad);
            const y2 = 100 + 90 * Math.sin(rad);
            
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isClassic ? '#333' : isModern ? '#666' : 'currentColor'}
                strokeWidth={isMinimal ? '1' : '2'}
                className={isMinimal ? 'text-muted-foreground' : ''}
              />
            );
          })}
          
          {/* Hour hand */}
          <line
            x1="100"
            y1="100"
            x2={100 + 50 * Math.cos(((hourAngle - 90) * Math.PI) / 180)}
            y2={100 + 50 * Math.sin(((hourAngle - 90) * Math.PI) / 180)}
            stroke={isClassic ? '#000' : isModern ? '#fff' : 'currentColor'}
            strokeWidth={isMinimal ? '2' : '4'}
            strokeLinecap="round"
            className={isMinimal ? 'text-foreground' : ''}
          />
          
          {/* Minute hand */}
          <line
            x1="100"
            y1="100"
            x2={100 + 70 * Math.cos(((minuteAngle - 90) * Math.PI) / 180)}
            y2={100 + 70 * Math.sin(((minuteAngle - 90) * Math.PI) / 180)}
            stroke={isClassic ? '#000' : isModern ? '#fff' : 'currentColor'}
            strokeWidth={isMinimal ? '1.5' : '3'}
            strokeLinecap="round"
            className={isMinimal ? 'text-foreground' : ''}
          />
          
          {/* Second hand */}
          {!isMinimal && (
            <line
              x1="100"
              y1="100"
              x2={100 + 75 * Math.cos(((secondAngle - 90) * Math.PI) / 180)}
              y2={100 + 75 * Math.sin(((secondAngle - 90) * Math.PI) / 180)}
              stroke={isClassic ? '#f00' : '#0ff'}
              strokeWidth="1"
              strokeLinecap="round"
            />
          )}
          
          {/* Center dot */}
          <circle
            cx="100"
            cy="100"
            r={isMinimal ? '2' : '4'}
            fill={isClassic ? '#000' : isModern ? '#fff' : 'currentColor'}
            className={isMinimal ? 'text-foreground' : ''}
          />
        </svg>
      </div>
      
      {date && (
        <div className="text-xs text-muted-foreground">{date}</div>
      )}
      {timezone && (
        <div className="text-xs text-muted-foreground">{timezone}</div>
      )}
    </div>
  );
}

interface ClockViewProps {
  clockConfig: ClockConfig;
}

export function ClockView({clockConfig}: ClockViewProps) {
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [sunTimes, setSunTimes] = useState<SunTimes | null>(null);
    const [isLoadingSun, setIsLoadingSun] = useState(false);
    const [sunError, setSunError] = useState<string | null>(null);
    const intervalRef = useRef<number | null>(null);

    // Get timezone
    const timezone = clockConfig.timezone || getSystemTimezone();
    const timezoneDisplay = clockConfig.timezone ? getTimezoneDisplayName(clockConfig.timezone) : undefined;

    // Format time based on format preference
    const formatTime = (date: Date): string => {
      const options: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: clockConfig.theme?.includes('digital-modern') ? '2-digit' : undefined,
        hour12: clockConfig.format === '12h',
        timeZone: timezone,
      };
      return date.toLocaleTimeString(undefined, options);
    };

    // Format date
    const formatDate = (date: Date): string => {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone,
      };
      return date.toLocaleDateString(undefined, options);
    };

    // Update time every second
    useEffect(() => {
      const updateTime = () => {
        setCurrentTime(new Date());
      };
      
      updateTime();
      intervalRef.current = window.setInterval(updateTime, 1000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, []);

    // Fetch sun times if needed
    useEffect(() => {
      if ((clockConfig.showSunrise || clockConfig.showSunset) && clockConfig.latitude && clockConfig.longitude) {
        setIsLoadingSun(true);
        setSunError(null);
        
        fetchSunTimes(clockConfig.latitude, clockConfig.longitude)
          .then((times) => {
            setSunTimes(times);
            setIsLoadingSun(false);
          })
          .catch((err) => {
            console.error('Failed to fetch sun times:', err);
            setSunError('Failed to load sun times');
            setIsLoadingSun(false);
          });
      } else {
        setSunTimes(null);
      }
    }, [clockConfig.showSunrise, clockConfig.showSunset, clockConfig.latitude, clockConfig.longitude]);

    // Format sun time for display
    const formatSunTime = (isoString: string): string => {
      try {
        const date = new Date(isoString);
        const options: Intl.DateTimeFormatOptions = {
          hour: '2-digit',
          minute: '2-digit',
          hour12: clockConfig.format === '12h',
          timeZone: timezone,
        };
        return date.toLocaleTimeString(undefined, options);
      } catch {
        return '';
      }
    };

    // Get time components in the selected timezone
    const getTimeInTimezone = (date: Date, tz: string) => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(date);
      const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
      const second = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);
      return { hour, minute, second };
    };

    const timeString = formatTime(currentTime);
    const dateString = clockConfig.showDate ? formatDate(currentTime) : '';
    const analogTime = getTimeInTimezone(currentTime, timezone);

    // Render based on theme
    const renderClock = () => {
      switch (clockConfig.theme) {
        case 'digital-simple':
          return <DigitalSimple time={timeString} date={dateString} timezone={timezoneDisplay} />;
        case 'digital-modern':
          return <DigitalModern time={timeString} date={dateString} timezone={timezoneDisplay} />;
        case 'digital-neon':
          return <DigitalNeon time={timeString} date={dateString} timezone={timezoneDisplay} />;
        case 'digital-minimal':
          return <DigitalMinimal time={timeString} date={dateString} timezone={timezoneDisplay} />;
        case 'analog-classic':
        case 'analog-modern':
        case 'analog-minimal':
          return (
            <AnalogClock 
              hours={analogTime.hour % 12}
              minutes={analogTime.minute}
              seconds={analogTime.second}
              date={dateString} 
              timezone={timezoneDisplay} 
              theme={clockConfig.theme} 
            />
          );
        default:
          return <DigitalSimple time={timeString} date={dateString} timezone={timezoneDisplay} />;
      }
    };

    return (
      <div className="h-full flex flex-col overflow-hidden p-2">
        {/* Main clock display */}
        <div className="flex-1 flex items-center justify-center">
          {renderClock()}
        </div>

        {/* Sun times (small, at the bottom) */}
        {(clockConfig.showSunrise || clockConfig.showSunset) && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
            {isLoadingSun && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {sunError && (
              <div className="flex items-center gap-1 text-destructive">
                <AlertCircle className="w-3 h-3" />
                <span>{sunError}</span>
              </div>
            )}
            {sunTimes && !isLoadingSun && !sunError && (
              <>
                {clockConfig.showSunrise && (
                  <div className="flex items-center gap-1">
                    <Sunrise className="w-3 h-3" />
                    <span>{formatSunTime(sunTimes.sunrise)}</span>
                  </div>
                )}
                {clockConfig.showSunset && (
                  <div className="flex items-center gap-1">
                    <Sunset className="w-3 h-3" />
                    <span>{formatSunTime(sunTimes.sunset)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
}