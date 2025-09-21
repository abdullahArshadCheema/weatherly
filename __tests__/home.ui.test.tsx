import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '../pages/index';

// Mock next/head to avoid side effects
vi.mock('next/head', () => ({ default: ({ children }: any) => <>{children}</> }));

const geoSuccess = (coords: { latitude: number; longitude: number }) => {
  (global.navigator.geolocation.getCurrentPosition as any) = (success: any) => {
    success({ coords });
  };
};

const geoError = (code: number, message: string) => {
  (global.navigator.geolocation.getCurrentPosition as any) = (_s: any, err: any) => {
    err({ code, message });
  };
};

describe('Home page UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // default mock fetch for search
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('geocoding-api.open-meteo.com/v1/search')) {
        return { ok: true, json: async () => ({ results: [{ id: 1, name: 'London', country: 'GB', admin1: 'England', latitude: 51.5, longitude: -0.1 }] }) } as any;
      }
      if (u.includes('geocoding-api.open-meteo.com/v1/reverse')) {
        return { ok: true, json: async () => ({ results: [{ id: 2, name: 'MyTown', country: 'GB', admin1: 'Region', latitude: 51.5, longitude: -0.1 }] }) } as any;
      }
      if (u.includes('api.open-meteo.com/v1/forecast')) {
        return { ok: true, json: async () => ({
          current: { temperature_2m: 20, wind_speed_10m: 10, weather_code: 0 },
          daily: { time: ['2025-09-20'], temperature_2m_max: [22], temperature_2m_min: [15], weather_code: [0] },
        }) } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    }) as any;

    // jsdom secure context mock
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(window, 'location', { value: { hostname: 'localhost' }, configurable: true });
  });

  it('shows suggestions while typing and loads weather on choose', async () => {
    render(<Home />);
    const input = screen.getByPlaceholderText(/Search city/i);
    fireEvent.change(input, { target: { value: 'Lon' } });
  await waitFor(() => expect(screen.getByText(/London, England, GB/)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/London, England, GB/));
    await waitFor(() => expect(screen.getByText(/Current/)).toBeInTheDocument());
  expect(screen.getByRole('heading', { name: /Weatherly/i })).toBeInTheDocument();
  });

  it('handles geolocation permission denied', async () => {
  render(<Home />);
  geoError(1, 'denied');
  const useButtons = screen.getAllByText(/Use my location/i);
  fireEvent.click(useButtons[0]);
    await waitFor(() => {
      const matches = screen.getAllByText(/Location permission denied/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('uses geolocation success path', async () => {
  render(<Home />);
  geoSuccess({ latitude: 51.5, longitude: -0.1 });
  const useButtons2 = screen.getAllByText(/Use my location/i);
  fireEvent.click(useButtons2[0]);
    await waitFor(() => expect(screen.getByText(/Current/)).toBeInTheDocument());
    expect(screen.getByText(/MyTown/)).toBeInTheDocument();
  });

  it('does not overwrite input while user is typing during reverse upgrade', async () => {
    render(<Home />);
    // First call to reverse returns placeholder; forecast OK; second reverse returns a real city
    let reverseCalls = 0;
    (global.fetch as any) = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('geocoding-api.open-meteo.com/v1/reverse')) {
        reverseCalls++;
        if (reverseCalls === 1) {
          return { ok: true, json: async () => ({ results: [{ id: 99, name: 'My location', country: 'GB', admin1: undefined, latitude: 51.5, longitude: -0.1 }] }) } as any;
        }
        return { ok: true, json: async () => ({ results: [{ id: 98, name: 'ResolvedCity', country: 'GB', admin1: 'Region', latitude: 51.5, longitude: -0.1 }] }) } as any;
      }
      if (u.includes('api.open-meteo.com/v1/forecast')) {
        return { ok: true, json: async () => ({
          current: { temperature_2m: 20, wind_speed_10m: 10, weather_code: 0 },
          daily: { time: ['2025-09-21'], temperature_2m_max: [22], temperature_2m_min: [15], weather_code: [0] },
        }) } as any;
      }
      if (u.includes('nominatim.openstreetmap.org/reverse')) {
        return { ok: true, json: async () => ({ address: { city: 'ResolvedCity', state: 'Region', country: 'GB' } }) } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });

    geoSuccess({ latitude: 51.5, longitude: -0.1 });
    fireEvent.click(screen.getAllByText(/Use my location/i)[0]);
    await waitFor(() => expect(screen.getByText(/Current/)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Search city/i) as HTMLInputElement;
    // User starts editing immediately
    fireEvent.change(input, { target: { value: 'Lon' } });
    expect(input.value).toBe('Lon');

    // Wait for reverse to settle and ensure input remains user-typed, not overwritten
    await waitFor(() => {
      expect(screen.getByText(/Current/)).toBeInTheDocument();
    });
    expect(input.value).toBe('Lon');
  });

  it('renders footer attribution', () => {
    render(<Home />);
    expect(screen.getByText(/assistance of GPT-5/i)).toBeInTheDocument();
  });

  it('upgrades label via nominatim fallback when open-meteo reverse is empty', async () => {
    render(<Home />);
    // mock fetch paths for this test only
    (global.fetch as any) = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.includes('geocoding-api.open-meteo.com/v1/reverse')) {
        return { ok: true, json: async () => ({ results: [] }) } as any;
      }
      if (u.includes('nominatim.openstreetmap.org/reverse')) {
        return { ok: true, json: async () => ({ address: { city: 'FallbackCity', state: 'StateX', country: 'CountryY' } }) } as any;
      }
      if (u.includes('api.open-meteo.com/v1/forecast')) {
        return { ok: true, json: async () => ({
          current: { temperature_2m: 21, wind_speed_10m: 7, weather_code: 1 },
          daily: { time: ['2025-09-21'], temperature_2m_max: [25], temperature_2m_min: [16], weather_code: [1] },
        }) } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });

    geoSuccess({ latitude: 10, longitude: 20 });
    const useButtons = screen.getAllByText(/Use my location/i);
    fireEvent.click(useButtons[0]);

    // Current card should load
    await waitFor(() => expect(screen.getByText(/Current/)).toBeInTheDocument());

    // Enable debug to ensure reverse fallback executed (optional visibility)
    fireEvent.click(screen.getByText(/Show debug/i));

    // The label should include the fallback city, not "My location"
    await waitFor(() => expect(screen.getByText(/FallbackCity/)).toBeInTheDocument());
    expect(screen.queryByText(/My location: My location/)).not.toBeInTheDocument();
  });
});
