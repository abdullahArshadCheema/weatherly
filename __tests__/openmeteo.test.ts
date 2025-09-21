import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildForecastUrl, fetchWeather, searchCity, reverseGeocode, buildReverseUrl, buildNominatimReverseUrl } from '../lib/openmeteo';

const originalFetch = global.fetch;

describe('openmeteo utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds forecast URL with units', () => {
    const url = buildForecastUrl(10, 20, 'metric');
    expect(url).toContain('latitude=10');
    expect(url).toContain('longitude=20');
    expect(url).toContain('temperature_unit=celsius');
    expect(url).toContain('wind_speed_unit=kmh');
  });

  it('fetchWeather parses response', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: any) => {
      return {
        ok: true,
        json: async () => ({
          current: { temperature_2m: 12.3, wind_speed_10m: 5.6, weather_code: 2 },
          daily: {
            time: ['2025-09-20'],
            temperature_2m_max: [18.2],
            temperature_2m_min: [9.4],
            weather_code: [3],
          },
        }),
      } as any;
    }));

    const data = await fetchWeather(10, 20, 'metric');
    expect(data.current.temperature).toBe(12.3);
    expect(data.daily[0].max).toBe(18.2);
  });

  it('reverseGeocode returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const r = await reverseGeocode(1, 2);
    expect(r).toBeNull();
  });

  it('builds reverse urls for providers', () => {
    const a = buildReverseUrl(1, 2, 'en');
    expect(a).toContain('latitude=1');
    expect(a).toContain('longitude=2');
    const b = buildNominatimReverseUrl(12.34, 56.78, 'en');
    expect(b).toContain('lat=12.34');
    expect(b).toContain('lon=56.78');
    expect(b).toContain('format=jsonv2');
  });

  it('falls back to nominatim when open-meteo reverse has no results', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('geocoding-api.open-meteo.com/v1/reverse')) {
        return { ok: true, json: async () => ({ results: [] }) } as any;
      }
      if (u.includes('nominatim.openstreetmap.org/reverse')) {
        return { ok: true, json: async () => ({ address: { city: 'FallbackCity', state: 'StateX', country: 'CountryY' } }) } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    }));
    const r = await reverseGeocode(10, 20);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('FallbackCity');
    expect(r!.provider).toBe('nominatim');
  });

  it('searchCity maps results', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [{ id: 1, name: 'Paris', country: 'FR', admin1: 'Ile-de-France', latitude: 48.8, longitude: 2.3, timezone: 'Europe/Paris' }] }),
    }) as any));
    const r = await searchCity('par');
    expect(r[0].name).toBe('Paris');
  });
});
