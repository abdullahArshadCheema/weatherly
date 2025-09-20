import type { GeoResult, Units, WeatherResponse, DailyForecast } from '../types/weather';

export async function searchCity(name: string): Promise<GeoResult[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', name);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to search location');
  const json = await res.json();
  if (!json?.results) return [];
  return (json.results as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));
}

export async function fetchWeather(lat: number, lon: number, units: Units): Promise<WeatherResponse> {
  const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius';
  const windUnit = units === 'imperial' ? 'mph' : 'kmh';

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('temperature_unit', tempUnit);
  url.searchParams.set('wind_speed_unit', windUnit);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch weather');
  const data = await res.json();

  const current = {
    temperature: data?.current?.temperature_2m,
    windSpeed: data?.current?.wind_speed_10m,
    weatherCode: data?.current?.weather_code,
  };

  const daily: DailyForecast = (data?.daily?.time || []).map((t: string, i: number) => ({
    date: t,
    max: data?.daily?.temperature_2m_max?.[i],
    min: data?.daily?.temperature_2m_min?.[i],
    weatherCode: data?.daily?.weather_code?.[i],
  }));

  return {
    location: { name: '', latitude: lat, longitude: lon },
    units,
    current,
    daily,
  };
}

export function codeToLabel(code: number): string {
  const map: Record<string, string> = {
    '0': 'Clear sky',
    '1': 'Mainly clear',
    '2': 'Partly cloudy',
    '3': 'Overcast',
    '45': 'Fog',
    '48': 'Depositing rime fog',
    '51': 'Drizzle: Light',
    '53': 'Drizzle: Moderate',
    '55': 'Drizzle: Dense',
    '61': 'Rain: Slight',
    '63': 'Rain: Moderate',
    '65': 'Rain: Heavy',
    '71': 'Snow fall: Slight',
    '73': 'Snow fall: Moderate',
    '75': 'Snow fall: Heavy',
    '80': 'Rain showers: Slight',
    '81': 'Rain showers: Moderate',
    '82': 'Rain showers: Violent',
    '95': 'Thunderstorm',
  };
  return map[String(code)] || 'Unknown';
}
