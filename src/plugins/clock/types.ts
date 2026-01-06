export type ClockTheme = 
  | 'digital-simple'
  | 'digital-modern'
  | 'digital-neon'
  | 'digital-minimal'
  | 'analog-classic'
  | 'analog-modern'
  | 'analog-minimal';

export type ClockFormat = '12h' | '24h';

export interface ClockConfig {
  theme: ClockTheme;
  timezone?: string; // IANA timezone (e.g., 'Europe/Paris', 'America/New_York')
  showDate: boolean;
  format: ClockFormat;
  showSunrise: boolean;
  showSunset: boolean;
  latitude?: number; // Required if showSunrise or showSunset is true
  longitude?: number; // Required if showSunrise or showSunset is true
  cacheDuration?: number;
}

export interface SunTimes {
  sunrise: string; // ISO 8601 format
  sunset: string; // ISO 8601 format
}



