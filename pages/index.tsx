import Head from 'next/head';
import { useEffect, useState } from 'react';
import { fetchWeather, searchCity, codeToLabel } from '../lib/openmeteo';
import type { GeoResult, Units, WeatherResponse } from '../types/weather';

export default function Home() {
  const [q, setQ] = useState('');
  const [units, setUnits] = useState<Units>('metric');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const w = await fetchWeather(selected.latitude, selected.longitude, units);
        setWeather({ ...w, location: selected });
      } catch (e: any) {
        setError(e?.message || 'Failed to fetch weather');
      } finally {
        setLoading(false);
      }
    })();
  }, [selected, units]);

  async function onSearch() {
    if (!q.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const r = await searchCity(q.trim());
      setResults(r);
      if (r.length > 0) setSelected(r[0]);
    } catch (e: any) {
      setError(e?.message || 'Failed to search');
    } finally {
      setLoading(false);
    }
  }

  function onGeoLocate() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    setError(null);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const w = await fetchWeather(latitude, longitude, units);
          setSelected({ name: 'My location', latitude, longitude });
          setWeather({ ...w, location: { name: 'My location', latitude, longitude } });
        } catch (e: any) {
          setError(e?.message || 'Failed to fetch weather');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message || 'Geolocation failed');
        setLoading(false);
      }
    );
  }

  return (
    <>
      <Head>
        <title>Weatherly</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className="min-h-screen bg-gradient-to-b from-sky-50 to-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Weatherly</h1>
            <div className="flex items-center gap-3 text-sm">
              <button
                onClick={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Units: {units === 'metric' ? '°C, km/h' : '°F, mph'}
              </button>
              <button
                onClick={onGeoLocate}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-white shadow-sm hover:bg-slate-800"
              >
                Use my location
              </button>
            </div>
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="Search city (e.g., London)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
              <button
                onClick={onSearch}
                className="rounded-lg bg-sky-600 px-4 py-2 text-white shadow-sm hover:bg-sky-500"
              >
                Search
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            {results.length > 0 && (
              <div className="mt-3 text-sm text-slate-600">
                Showing top result: {results[0].name}{results[0].admin1 ? `, ${results[0].admin1}` : ''}{results[0].country ? `, ${results[0].country}` : ''}
              </div>
            )}
          </section>

          <section className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-medium text-slate-900">Current</h2>
              {!weather && !loading && (
                <p className="mt-2 text-sm text-slate-500">Search for a city or use your location.</p>
              )}
              {loading && (
                <div className="mt-3 inline-flex items-center gap-2 text-slate-600">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Loading…
                </div>
              )}
              {weather && (
                <div className="mt-3">
                  <div className="text-sm text-slate-500">{weather.location.name}</div>
                  <div className="mt-1 text-4xl font-semibold">
                    {Math.round(weather.current.temperature)}°{units === 'metric' ? 'C' : 'F'}
                  </div>
                  <div className="mt-1 text-slate-600">
                    {codeToLabel(weather.current.weatherCode)} · wind {Math.round(weather.current.windSpeed)} {units === 'metric' ? 'km/h' : 'mph'}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-medium text-slate-900">7-day forecast</h2>
              {weather?.daily && (
                <ul className="mt-3 divide-y divide-slate-100">
                  {weather.daily.map((d) => (
                    <li key={d.date} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="text-slate-700">{codeToLabel(d.weatherCode)}</span>
                      <span className="tabular-nums text-slate-900">
                        {Math.round(d.min)}° / {Math.round(d.max)}° {units === 'metric' ? 'C' : 'F'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
