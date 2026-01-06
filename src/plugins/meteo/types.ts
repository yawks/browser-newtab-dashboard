export type MeteoProvider = 'openweather';

export interface MeteoConfig {
  provider: MeteoProvider;
  apiKey: string;
  cityName?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  cacheDuration?: number;
}

export interface MeteoCitySuggestion {
  id?: string;
  name: string;
  state?: string;
  country: string;
  lat: number;
  lon: number;
}

export interface MeteoCurrentWeather {
  temperature: number;
  minTemperature: number;
  maxTemperature: number;
  description: string;
  icon: string;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
}

export interface MeteoForecastDay {
  date: string;
  minTemperature: number;
  maxTemperature: number;
  icon: string;
  description: string;
}

export interface MeteoWeatherData {
  current: MeteoCurrentWeather;
  forecast: MeteoForecastDay[];
  provider: MeteoProvider;
  cityName: string;
  country?: string;
}

