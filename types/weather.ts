export type GeoResult = {
  id?: number;
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type Units = 'metric' | 'imperial';

export type CurrentWeather = {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
};

export type DailyForecast = Array<{
  date: string;
  max: number;
  min: number;
  weatherCode: number;
}>;

export type WeatherResponse = {
  location: GeoResult;
  units: Units;
  current: CurrentWeather;
  daily: DailyForecast;
};
