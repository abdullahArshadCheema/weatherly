import React from 'react';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { fetchWeather, searchCity, reverseGeocode, codeToLabel, codeToEmoji, buildForecastUrl, buildReverseUrl, formatPlace, buildNominatimReverseUrl } from '../lib/openmeteo';
import type { GeoResult, Units, WeatherResponse } from '../types/weather';

export default function Home() {
  const [q, setQ] = useState('');
  const [units, setUnits] = useState<Units>('metric');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [lastReverseUrl, setLastReverseUrl] = useState<string | null>(null);
  const [lastReverseProvider, setLastReverseProvider] = useState<'open-meteo' | 'nominatim' | null>(null);
  const [fromGeo, setFromGeo] = useState<boolean>(false);
  const [pendingReverse, setPendingReverse] = useState<{lat: number; lon: number} | null>(null);
  const [resolvingName, setResolvingName] = useState(false);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [lastSelectedLabel, setLastSelectedLabel] = useState<string | null>(null);
  const [userEdited, setUserEdited] = useState<boolean>(false);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
  const url = buildForecastUrl(selected.latitude, selected.longitude, units);
  setLastUrl(url);
  const w = await fetchWeather(selected.latitude, selected.longitude, units);
        setWeather({ ...w, location: selected });
      } catch (e: any) {
        setError(e?.message || 'Failed to fetch weather');
      } finally {
        setLoading(false);
      }
    })();
  }, [selected, units]);

  // If we selected a placeholder name from geolocation, try to upgrade the label asynchronously
  useEffect(() => {
    if (!pendingReverse) return;
    (async () => {
      try {
        if (pendingReverse) setResolvingName(true);
        const place = await reverseGeocode(pendingReverse.lat, pendingReverse.lon);
        if (place) {
          const lang = typeof navigator !== 'undefined' ? (navigator.language?.split('-')[0] || 'en') : 'en';
          if (place.provider === 'open-meteo') {
            setLastReverseProvider('open-meteo');
            setLastReverseUrl(buildReverseUrl(pendingReverse.lat, pendingReverse.lon, lang));
          } else if (place.provider === 'nominatim') {
            setLastReverseProvider('nominatim');
            setLastReverseUrl(buildNominatimReverseUrl(pendingReverse.lat, pendingReverse.lon, lang));
          }
          setSelected(place); // triggers fetch-useEffect again with same coords (idempotent)
          const newLabel = formatPlace(place);
          const baseline = (lastSelectedLabel || '').trim().toLowerCase();
          const current = q.trim().toLowerCase();
          if (!userEdited || current === baseline) {
            setQ(newLabel);
            setLastSelectedLabel(newLabel);
            setUserEdited(false);
          }
        }
      } finally {
        setPendingReverse(null);
        setResolvingName(false);
      }
    })();
  }, [pendingReverse]);

  // Debounced search suggestions
  useEffect(() => {
    const id = setTimeout(async () => {
      const term = q.trim();
      if (!term) {
        setResults([]);
        setShowList(false);
        return;
      }
      // If the input equals the selected label, don't show suggestions
      if (selected && term.toLowerCase() === formatPlace(selected).toLowerCase()) {
        setResults([]);
        setShowList(false);
        return;
      }
      try {
        const r = await searchCity(term);
        // Filter out any exact match to the current input to avoid redundant suggestion
        const filtered = r.filter((item) => formatPlace(item).toLowerCase() !== term.toLowerCase());
        setResults(filtered);
        setShowList(filtered.length > 0);
      } catch (e) {
        // ignore for typeahead
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  async function onChoose(place: GeoResult) {
    const label = formatPlace(place);
    setSelected(place);
    setQ(label);
    setLastSelectedLabel(label);
    setUserEdited(false);
    setShowList(false);
    setFromGeo(false);
  }

  function onGeoLocate() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    // Geolocation requires a secure context (HTTPS) except on localhost.
    if (typeof window !== 'undefined') {
      const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (!window.isSecureContext && !isLocal) {
        setError('Use my location only works over HTTPS or localhost. Run dev (`npm run dev`) or open via http://localhost.');
        return;
      }
    }
    setError(null);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const place = (await reverseGeocode(latitude, longitude)) || { name: 'My location', latitude, longitude } as GeoResult;
          // Let the effect perform the fetch by setting selected
          setSelected(place);
          if (!('admin1' in place) || place.name === 'My location') {
            setPendingReverse({ lat: latitude, lon: longitude });
          }
          // capture reverse provider/URL if already resolved
          const lang = typeof navigator !== 'undefined' ? (navigator.language?.split('-')[0] || 'en') : 'en';
          if ((place as GeoResult).provider === 'open-meteo') {
            setLastReverseProvider('open-meteo');
            setLastReverseUrl(buildReverseUrl(latitude, longitude, lang));
          } else if ((place as GeoResult).provider === 'nominatim') {
            setLastReverseProvider('nominatim');
            setLastReverseUrl(buildNominatimReverseUrl(latitude, longitude, lang));
          } else {
            setLastReverseProvider(null);
            setLastReverseUrl(null);
          }
          // reflect resolved name in the search input for clarity
          const label = formatPlace(place);
          setQ(label);
          setLastSelectedLabel(label);
          setUserEdited(false);
          setFromGeo(true);
        } catch (e: any) {
          setError(e?.message || 'Failed to fetch weather for your location');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        let msg = err?.message || 'Geolocation failed';
        // friendlier messages by error code
        // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
        if (typeof err?.code === 'number') {
          if (err.code === 1) msg = 'Location permission denied. Please allow access or use Search.';
          else if (err.code === 2) msg = 'Position unavailable. Check GPS/network and try again.';
          else if (err.code === 3) msg = 'Location request timed out. Try again or use Search.';
        }
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  return (
    <>
      <Head>
        <title>Weatherly</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-slate-100 flex flex-col">
        <main className="flex-1 px-4 py-10">
          <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Weatherly</h1>
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setUnits(units === 'metric' ? 'imperial' : 'metric')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Units: {units === 'metric' ? '°C, km/h' : '°F, mph'}
              </button>
              <button
                type="button"
                onClick={onGeoLocate}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-white shadow-sm hover:bg-slate-800"
              >
                Use my location
              </button>
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 shadow-sm hover:bg-slate-50"
                aria-pressed={showDebug}
                title="Toggle debug info"
              >
                {showDebug ? 'Hide debug' : 'Show debug'}
              </button>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative">
              <div className="flex gap-3">
                <input
                  value={q}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQ(val);
                    const baseline = (lastSelectedLabel || '').trim().toLowerCase();
                    setUserEdited(val.trim().toLowerCase() !== baseline);
                  }}
                  placeholder="Search city (e.g., London)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    const term = q.trim();
                    const exact = results.find((r) => formatPlace(r).toLowerCase() === term.toLowerCase());
                    if (exact) onChoose(exact);
                    else if (results[0]) onChoose(results[0]);
                  }}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-white shadow-sm hover:bg-sky-500"
                >
                  Go
                </button>
              </div>
              {showList && results.length > 0 && (
                <ul className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {results.map((r) => (
                    <li
                      key={`${r.latitude},${r.longitude}`}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => onChoose(r)}
                    >
                      {formatPlace(r)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </section>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                  <div className="text-sm text-slate-500">
                    {fromGeo ? `My location: ${formatPlace(weather.location)}` : formatPlace(weather.location)}
                    {fromGeo && resolvingName && weather.location.name === 'My location' ? ' (resolving name…)' : ''}
                  </div>
                  <div className="mt-1 flex items-end gap-3">
                    <div className="text-5xl leading-none">{codeToEmoji(weather.current.weatherCode)}</div>
                    <div className="text-4xl font-semibold">
                      {Math.round(weather.current.temperature)}°{units === 'metric' ? 'C' : 'F'}
                    </div>
                  </div>
                  <div className="mt-1 text-slate-600">
                    {codeToLabel(weather.current.weatherCode)} · wind {Math.round(weather.current.windSpeed)} {units === 'metric' ? 'km/h' : 'mph'}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-medium text-slate-900">7-day forecast</h2>
              {weather?.daily && (
                <ul className="mt-3 divide-y divide-slate-100">
                  {weather.daily.map((d) => (
                    <li key={d.date} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <span className="min-w-[4ch] text-center text-lg">{codeToEmoji(d.weatherCode)}</span>
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

          {/* Debug panel for diagnosing failures (toggleable) */}
          {showDebug && (lastUrl || lastReverseUrl || error) && (
            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="mb-1 font-medium">Debug info</div>
              {error && <div className="text-sm">Error: {error}</div>}
              {lastReverseProvider && (
                <div className="mt-1 text-xs">Reverse provider: {lastReverseProvider}</div>
              )}
              {lastReverseUrl && (
                <div className="mt-1 text-xs break-all">
                  Reverse URL: <a className="text-amber-800 underline" href={lastReverseUrl} target="_blank" rel="noreferrer">{lastReverseUrl}</a>
                </div>
              )}
              {lastUrl && (
                <div className="mt-1 text-xs break-all">
                  URL: <a className="text-amber-800 underline" href={lastUrl} target="_blank" rel="noreferrer">{lastUrl}</a>
                </div>
              )}
            </section>
          )}
          </div>
        </main>
        <footer className="px-4 py-6 text-center text-sm text-slate-500">
          This app was built with the assistance of GPT-5.
        </footer>
      </div>
    </>
  );
}
