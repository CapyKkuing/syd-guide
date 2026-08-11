import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import { FORECAST_CACHE_MS } from "../../worker/db/weather";
import type { Env } from "../../worker/env";
import { purgeExpiredWeatherSnapshots } from "../../worker/services/purge";

const initialNow = new Date("2026-08-12T00:00:00.000Z");

function bindings(configured = true): Env {
  return {
    ...env,
    SURFACE: "partner",
    APP_ORIGIN: "http://localhost",
    PARTNER_ORIGIN: "http://localhost",
    DEV_AUTH: "enabled",
    WEATHERAPI_KEY: configured ? "weather-test-key" : undefined,
  };
}

function headers(): Headers {
  return new Headers({ Origin: "http://localhost", "X-Dev-Principal": "owner" });
}

async function seedTrip() {
  await env.DB.prepare(
    `INSERT INTO trips (
      id, title, destination, start_date, end_date, time_zone, status,
      version, sync_version, created_by, updated_by, created_at, updated_at
    ) VALUES ('trip-weather', '날씨 QA 여행', 'Sydney, Australia', '2026-08-10', '2026-08-14',
      'Australia/Sydney', 'active', 1, 0, 'owner', 'owner', ?, ?)`
  ).bind(initialNow.toISOString(), initialNow.toISOString()).run();
  await env.DB.prepare(
    "INSERT INTO trip_members (trip_id, member_id, joined_at) VALUES ('trip-weather', 'owner', ?)"
  ).bind(initialNow.toISOString()).run();
}

function forecastResponse(lastUpdatedEpoch = 1_786_550_400) {
  return Response.json({
    location: {
      name: "Sydney",
      lat: -33.87,
      lon: 151.21,
      tz_id: "Australia/Sydney",
    },
    current: {
      last_updated_epoch: lastUpdatedEpoch,
      temp_c: 19.5,
      uv: 4,
      condition: { text: "맑음", code: 1000 },
    },
    forecast: {
      forecastday: [{
        date: "2026-08-12",
        day: {
          maxtemp_c: 22,
          mintemp_c: 13,
          condition: { text: "맑음", code: 1000 },
        },
      }],
    },
  });
}

describe("WeatherAPI weather route", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM trips").run();
    await env.DB.prepare("DELETE FROM weather_provider_usage").run();
    await env.DB.prepare("DELETE FROM weather_current_snapshots").run();
    await env.DB.prepare("DELETE FROM weather_forecast_snapshots").run();
    await seedTrip();
  });

  it("stores normalized current and forecast data, then serves the 60 minute cache", async () => {
    const weatherFetch = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe("https://api.weatherapi.com/v1/forecast.json");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        key: "weather-test-key", q: "Sydney, Australia", days: "3", aqi: "no", alerts: "no", lang: "ko",
      });
      return forecastResponse();
    });
    const app = createApp({ now: () => initialNow, weatherFetch });

    const first = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );
    const second = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      status: "live",
      weather: {
        location: {
          name: "Sydney",
          latitude: -33.87,
          longitude: 151.21,
          timeZone: "Australia/Sydney",
        },
        temperatureC: 19.5,
        forecast: [{ date: "2026-08-12", maxTemperatureC: 22, minTemperatureC: 13 }],
      },
      attribution: "WeatherAPI.com",
    });
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ status: "cached" });
    expect(weatherFetch).toHaveBeenCalledOnce();
    await expect(env.DB.prepare(
      "SELECT used_count FROM weather_provider_usage WHERE billing_month = '2026-08'"
    ).first()).resolves.toEqual({ used_count: 1 });
    const cache = await env.DB.prepare(
      "SELECT forecast_json FROM weather_forecast_snapshots WHERE trip_id = 'trip-weather'"
    ).first<{ forecast_json: string }>();
    expect(cache?.forecast_json).toContain("maxTemperatureC");
    expect(cache?.forecast_json).not.toContain("last_updated_epoch");
  });

  it("refreshes only current conditions while the 24 hour forecast cache is fresh", async () => {
    let now = initialNow;
    const weatherFetch = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("forecast.json")) return forecastResponse();
      return Response.json({
        location: {
          name: "Sydney",
          lat: -33.87,
          lon: 151.21,
          tz_id: "Australia/Sydney",
        },
        current: {
          last_updated_epoch: 1_786_554_000,
          temp_c: 21,
          uv: 5,
          condition: { text: "맑음", code: 1000 },
        },
      });
    });
    const app = createApp({ now: () => now, weatherFetch });

    await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    now = new Date(initialNow.getTime() + 61 * 60 * 1_000);
    const refreshed = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(refreshed.status).toBe(200);
    await expect(refreshed.json()).resolves.toMatchObject({
      status: "live",
      weather: { temperatureC: 21, forecast: [{ date: "2026-08-12" }] },
    });
    expect(new URL(String(weatherFetch.mock.calls[1]?.[0])).pathname)
      .toBe("/v1/current.json");
  });

  it("refreshes the full forecast when the trip destination changes", async () => {
    const weatherFetch = vi.fn<typeof fetch>(async () => forecastResponse());
    const app = createApp({ now: () => initialNow, weatherFetch });

    const first = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );
    await env.DB.prepare(
      "UPDATE trips SET destination = 'Melbourne, Australia' WHERE id = 'trip-weather'"
    ).run();
    const second = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ status: "live" });
    expect(weatherFetch.mock.calls.map((call) => {
      const url = new URL(String(call[0]));
      return [url.pathname, url.searchParams.get("q")];
    })).toEqual([
      ["/v1/forecast.json", "Sydney, Australia"],
      ["/v1/forecast.json", "Melbourne, Australia"],
    ]);
  });

  it("treats malformed forecast JSON as a cache miss without returning a server error", async () => {
    await env.DB.prepare(
      `INSERT INTO weather_forecast_snapshots (
        trip_id, query, forecast_json, fetched_at, expires_at, updated_at
      ) VALUES ('trip-weather', ?, ?, ?, ?, ?)`
    ).bind(
      "Sydney, Australia",
      "not-json",
      initialNow.toISOString(),
      new Date(initialNow.getTime() + FORECAST_CACHE_MS).toISOString(),
      initialNow.toISOString(),
    ).run();
    const weatherFetch = vi.fn<typeof fetch>(async () => forecastResponse());
    const app = createApp({ now: () => initialNow, weatherFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "live" });
    expect(weatherFetch).toHaveBeenCalledOnce();
  });

  it("refreshes the full forecast when its 24 hour cache expires before current", async () => {
    let now = initialNow;
    const weatherFetch = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("forecast.json")) return forecastResponse();
      return Response.json({
        location: {
          name: "Sydney",
          lat: -33.87,
          lon: 151.21,
          tz_id: "Australia/Sydney",
        },
        current: {
          last_updated_epoch: 1_786_554_000,
          temp_c: 21,
          uv: 5,
          condition: { text: "맑음", code: 1000 },
        },
      });
    });
    const app = createApp({ now: () => now, weatherFetch });

    await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    now = new Date(initialNow.getTime() + (23 * 60 + 30) * 60 * 1_000);
    await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    now = new Date(initialNow.getTime() + (24 * 60 + 1) * 60 * 1_000);
    const refreshed = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(refreshed.status).toBe(200);
    await expect(refreshed.json()).resolves.toMatchObject({
      status: "live",
      weather: { forecast: [{ date: "2026-08-12" }] },
    });
    expect(weatherFetch.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual([
      "/v1/forecast.json",
      "/v1/current.json",
      "/v1/forecast.json",
    ]);
  });

  it("blocks a provider request at the product monthly limit", async () => {
    await env.DB.prepare(
      "INSERT INTO weather_provider_usage (billing_month, used_count, updated_at) VALUES ('2026-08', 10000, ?)"
    ).bind(initialNow.toISOString()).run();
    const weatherFetch = vi.fn<typeof fetch>();
    const app = createApp({ now: () => initialNow, weatherFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "WEATHER_FREE_LIMIT_REACHED" },
    });
    expect(weatherFetch).not.toHaveBeenCalled();
  });

  it("allows one concurrent provider reservation at the monthly limit and rejects the other", async () => {
    await env.DB.prepare(
      "INSERT INTO weather_provider_usage (billing_month, used_count, updated_at) VALUES ('2026-08', 9999, ?)"
    ).bind(initialNow.toISOString()).run();
    let releaseProvider!: () => void;
    let providerStartedResolve!: () => void;
    const providerStarted = new Promise<void>((resolve) => {
      providerStartedResolve = resolve;
    });
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const weatherFetch = vi.fn<typeof fetch>(async () => {
      providerStartedResolve();
      await providerGate;
      return forecastResponse();
    });
    const app = createApp({ now: () => initialNow, weatherFetch });

    const firstRequest = app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );
    await providerStarted;
    const secondResponse = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );
    releaseProvider();
    const firstResponse = await firstRequest;

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(429);
    expect(weatherFetch).toHaveBeenCalledOnce();
    await expect(env.DB.prepare(
      "SELECT used_count FROM weather_provider_usage WHERE billing_month = '2026-08'"
    ).first()).resolves.toEqual({ used_count: 10000 });
  });

  it("returns a quiet unavailable state when local development has no WeatherAPI key", async () => {
    const app = createApp({ now: () => initialNow });
    const response = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(false),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "unavailable",
      location: "Sydney, Australia",
      weather: null,
      message: "날씨 연결을 준비 중입니다. 여행 일정은 계속 확인할 수 있습니다.",
    });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM weather_provider_usage"
    ).first()).resolves.toEqual({ count: 0 });
  });

  it("converts a provider network failure into the weather error contract", async () => {
    const weatherFetch = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network unavailable");
    });
    const app = createApp({ now: () => initialNow, weatherFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "WEATHER_PROVIDER_ERROR" },
    });
  });

  it("rejects a provider epoch outside the JavaScript Date range", async () => {
    const weatherFetch = vi.fn<typeof fetch>(async () => forecastResponse(Number.MAX_SAFE_INTEGER));
    const app = createApp({ now: () => initialNow, weatherFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "WEATHER_PROVIDER_ERROR" },
    });
  });

  it("maps a timed out route provider request to the 502 weather contract", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | null | undefined;
      let providerStartedResolve!: () => void;
      const providerStarted = new Promise<void>((resolve) => {
        providerStartedResolve = resolve;
      });
      const weatherFetch = vi.fn<typeof fetch>(async (_input, init) => {
        signal = init?.signal;
        providerStartedResolve();
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject({ name: "AbortError" });
          }, { once: true });
        });
      });
      const app = createApp({ now: () => initialNow, weatherFetch });
      const pending = app.request(
        "http://localhost/api/trips/trip-weather/weather",
        { headers: headers() },
        bindings(),
      );

      await providerStarted;
      await vi.advanceTimersByTimeAsync(10_000);
      const response = await pending;

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "WEATHER_PROVIDER_ERROR" },
      });
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps weather snapshots until their exact expiry boundary", async () => {
    const app = createApp({
      now: () => initialNow,
      weatherFetch: vi.fn<typeof fetch>(async () => forecastResponse()),
    });
    await app.request(
      "http://localhost/api/trips/trip-weather/weather",
      { headers: headers() },
      bindings(),
    );

    const earlyChanges = await purgeExpiredWeatherSnapshots(
      env.DB,
      new Date(initialNow.getTime() + 59 * 60 * 1_000).toISOString(),
    );
    const currentDueChanges = await purgeExpiredWeatherSnapshots(
      env.DB,
      new Date(initialNow.getTime() + 60 * 60 * 1_000).toISOString(),
    );
    const forecastDueChanges = await purgeExpiredWeatherSnapshots(
      env.DB,
      new Date(initialNow.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
    );

    expect(earlyChanges).toBe(0);
    expect(currentDueChanges).toBe(1);
    expect(forecastDueChanges).toBe(1);
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM weather_current_snapshots WHERE trip_id = 'trip-weather'"
    ).first()).resolves.toEqual({ count: 0 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM weather_forecast_snapshots WHERE trip_id = 'trip-weather'"
    ).first()).resolves.toEqual({ count: 0 });
  });
});
