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

export async function reverseGeocode(lat: number, lon: number): Promise<GeoResult | null> {
  const lang = typeof navigator !== 'undefined' ? (navigator.language?.split('-')[0] || 'en') : 'en';
  const makeUrl = () => {
    const u = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
    u.searchParams.set('latitude', String(lat));
    u.searchParams.set('longitude', String(lon));
    u.searchParams.set('language', lang);
    u.searchParams.set('format', 'json');
    u.searchParams.set('count', '1');
    return u;
  };

  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    let res: Response;
    try {
      res = await fetch(makeUrl().toString());
    } catch {
      if (attempt >= 2) break; // give up on OM, try fallback
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    if (!res.ok) {
      // Non-200 from Open-Meteo: fall through to fallback
      break;
    }
    const json = await res.json();
    const r = json?.results?.[0];
    if (!r) {
      if (attempt >= 2) break; // exhausted retries; try fallback
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    const informativeName = r?.localityInfo?.informative?.[0]?.name || r?.localityInfo?.administrative?.[0]?.name;
    const place: GeoResult = {
      id: r.id,
      name: r.name,
      country: r.country,
      admin1: r.admin1,
      admin2: r.admin2,
      admin3: (r as any).admin3,
      admin4: (r as any).admin4,
      locality: r.locality || informativeName,
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
      provider: 'open-meteo',
    };
    return place;
  }
  // Fallback to Nominatim (OpenStreetMap) if Open-Meteo yields nothing
  try {
    const nomUrl = new URL('https://nominatim.openstreetmap.org/reverse');
    nomUrl.searchParams.set('lat', String(lat));
    nomUrl.searchParams.set('lon', String(lon));
    nomUrl.searchParams.set('format', 'jsonv2');
    nomUrl.searchParams.set('zoom', '14');
    nomUrl.searchParams.set('addressdetails', '1');
    nomUrl.searchParams.set('accept-language', lang);
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(nomUrl.toString(), { headers: { 'Accept': 'application/json' }, signal: controller.signal });
    clearTimeout(to);
    if (res.ok) {
      const j: any = await res.json();
      const addr = j?.address || {};
      const primary = addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood || j?.name || j?.display_name;
      if (primary) {
        const place: GeoResult = {
          name: String(primary),
          country: addr.country || undefined,
          admin1: addr.state || addr.region || undefined,
          admin2: addr.county || undefined,
          latitude: lat,
          longitude: lon,
          timezone: undefined,
          provider: 'nominatim',
        };
        return place;
      }
    }
  } catch {}
  return null;
}

export function formatPlace(p: GeoResult): string {
  // Prefer a more city-like label if available
  const parts: string[] = [];
  const primary = p.name || p.locality || p.admin2 || p.admin1 || p.admin3 || p.admin4 || '';
  if (primary) parts.push(primary);
  if (p.admin1 && p.admin1 !== primary) parts.push(p.admin1);
  if (p.country) parts.push(p.country);
  return parts.filter(Boolean).join(', ');
}

export function buildReverseUrl(lat: number, lon: number, lang: string = 'en'): string {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('language', lang);
  url.searchParams.set('format', 'json');
  url.searchParams.set('count', '1');
  return url.toString();
}

export function buildNominatimReverseUrl(lat: number, lon: number, lang: string = 'en'): string {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('zoom', '14');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', lang);
  return url.toString();
}

export function buildForecastUrl(lat: number, lon: number, units: Units): string {
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
  return url.toString();
}

export async function fetchWeather(lat: number, lon: number, units: Units): Promise<WeatherResponse> {
  const url = buildForecastUrl(lat, lon, units);
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e: any) {
    throw new Error(`Network error fetching weather: ${e?.message || 'unknown error'}`);
  }
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`Weather API ${res.status}: ${body?.slice(0, 140)}`);
  }
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

export function codeToEmoji(code: number): string {
  const c = Number(code);
  if (c === 0) return '☀️';
  if (c === 1) return '🌤️';
  if (c === 2) return '⛅️';
  if (c === 3) return '☁️';
  if (c === 45 || c === 48) return '🌫️';
  if (c === 51 || c === 53 || c === 55) return '🌦️';
  if (c === 61 || c === 63 || c === 65 || c === 80 || c === 81 || c === 82) return '🌧️';
  if (c === 71 || c === 73 || c === 75) return '❄️';
  if (c === 95) return '⛈️';
  return '🌍';
}
