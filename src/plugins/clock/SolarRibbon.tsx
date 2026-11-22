import { useMemo } from 'react';
import { Sunrise, Sunset } from 'lucide-react';
import type { SunTimes } from './types';

interface Props {
  times: SunTimes;
  timezone: string;
  now: Date;
  showSunrise: boolean;
  showSunset: boolean;
  formatTime: (iso: string) => string;
}

export function SolarRibbon({ times, timezone, now, showSunrise, showSunset, formatTime }: Props) {
  const clock = useMemo(() => new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }), [timezone]);
  const position = (instant: Date | number) => {
    const [h, m] = clock.format(instant).split(':').map(Number);
    return (h * 60 + m) / 14.4;
  };
  const rise = Date.parse(times.sunrise);
  const set = Date.parse(times.sunset);
  const dawn = Date.parse(times.dawn);
  const dusk = Date.parse(times.dusk);
  const stops: [number, string][] = [
    [rise, '#f4ad58'], [(rise + set) / 2, '#73c8f4'], [set, '#ef9861'],
  ];
  if (dawn > 0 && dawn < rise) stops.push([dawn, '#273254'], [(dawn + rise) / 2, '#a68ac4']);
  if (dusk > set) stops.push([(set + dusk) / 2, '#ab7ba9'], [dusk, '#273254']);
  const colors = stops.map(([instant, color]) => ({ at: position(instant), color }))
    .sort((a, b) => a.at - b.at);
  // Repeat the neighbouring stops across midnight to keep the gradient continuous.
  const first = colors[0], last = colors[colors.length - 1];
  const gradient = [{ ...last, at: last.at - 100 }, ...colors, { ...first, at: first.at + 100 }]
    .map(({ at, color }) => `${color} ${at}%`).join(', ');
  const current = position(now);
  const between = (start: number, end: number) => {
    const a = position(start), b = position(end);
    return a <= b ? current >= a && current < b : current >= a || current < b;
  };
  const phase = between(rise, set) ? 'Daylight' : dawn > 0 && between(dawn, rise) ? 'Dawn'
    : dusk > set && between(set, dusk) ? 'Dusk' : 'Night';

  // Separate lanes keep labels readable even when the events are minutes apart.
  const marker = (isRise: boolean) => {
    const at = position(isRise ? rise : set);
    const Icon = isRise ? Sunrise : Sunset;
    return <div className="relative h-5">
      <span className={`absolute h-1 w-px bg-foreground ${isRise ? 'bottom-0' : 'top-0'}`}
        style={{ left: `${at}%` }} />
      <span className={`absolute w-32 max-w-full flex justify-center items-center gap-1 whitespace-nowrap text-[11px] ${isRise ? 'top-0' : 'bottom-0'}`}
        style={{ left: `clamp(0px, calc(${at}% - 4rem), max(0px, 100% - 8rem))` }}>
        <Icon size={13} aria-hidden="true" /> {isRise ? 'Sunrise' : 'Sunset'} {formatTime(isRise ? times.sunrise : times.sunset)}
      </span>
    </div>;
  };
  return <div className="w-full max-w-md px-1">
    {showSunrise && marker(true)}
    <div className="relative h-2 rounded-full" style={{ background: `linear-gradient(to right, ${gradient})` }}>
      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow"
        style={{ left: `${current}%` }} role="img" aria-label={`Now: ${phase}`} title={`Now: ${phase}`} />
    </div>
    {showSunset && marker(false)}
    <div className="text-center text-[10px]">{phase}</div>
  </div>;
}
