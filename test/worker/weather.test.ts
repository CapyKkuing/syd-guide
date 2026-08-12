import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import { FORECAST_CACHE_MS } from "../../worker/db/weather";
import type { Env } from "../../worker/env";
import { purgeExpiredWeatherSnapshots } from "../../worker/services/purge";
import type { WeatherResponse } from "../../src/shared/weather";

const initialNow = new Date("2026-08-12T00:00:00.000Z");
const attribution = "Open-Meteo · Best Match";

function bindings(): Env {
  return {
    ...env,
    SURFACE: "partner",
    APP_ORIGIN: "http://localhost",
    PARTNER_ORIGIN: "http://localhost",
    DEV_AUTH: "enabled",
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

function geocodingResponse(query: string) {
  const melbourne = query.startsWith("Melbourne");
  return Response.json({
    results: [{
      name: melbourne ? "Melbourne" : "Sydney",
      latitude: melbourne ? -37.8136 : -33.8688,
      longitude: melbourne ? 144.9631 : 151.2093,
      timezone: "Australia/Sydney",
    }],
  });
}

function forecastResponse(temperature = 19.5) {
  return Response.json({
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: "Australia/Sydney",
    current: { temperature_2m: temperature, weather_code: 0, uv_index: 4 },
    daily: {
      time: ["2026-08-12", "2026-08-13", "2026-08-14"],
      weather_code: [0, 3, 61],
      temperature_2m_max: [22, 21, 19],
      temperature_2m_min: [13, 14, 12],
    },
  });
}

function currentResponse(temperature = 21) {
  return Response.json({
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: "Australia/Sydney",
    current: { temperature_2m: temperature, weather_code: 3, uv_index: 5 },
  });
}

function openMeteoFetch() {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "geocoding-api.open-meteo.com") {
      return geocodingResponse(url.searchParams.get("name") ?? "");
    }
    return url.searchParams.has("daily") ? forecastResponse() : currentResponse();
  });
}

describe("Open-Meteo Best Match weather route", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM trips").run();
    await env.DB.prepare("DELETE FROM weather_provider_usage").run();
    await env.DB.prepare("DELETE FROM weather_current_snapshots").run();
    await env.DB.prepare("DELETE FROM weather_forecast_snapshots").run();
    await seedTrip();
  });

  it("geocodes once, stores current and forecast, then serves the 60 minute cache", async () => {
    const weatherFetch = openMeteoFetch();
    const app = createApp({ now: () => initialNow, weatherFetch });

    const first = await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    const second = await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());

    expect(first.status).toBe(200);
    const firstBody = await first.json() as WeatherResponse;
    expect(firstBody).toMatchObject({
      status: "live",
      weather: {
        location: { name: "Sydney", latitude: -33.8688, longitude: 151.2093, timeZone: "Australia/Sydney" },
        temperatureC: 19.5,
        condition: "맑음",
      },
      attribution,
    });
    expect(firstBody.weather).not.toBeNull();
    if (!firstBody.weather) throw new Error("Expected a weather snapshot");
    expect(firstBody.weather.forecast).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2026-08-12", maxTemperatureC: 22, minTemperatureC: 13 }),
    ]));
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({ status: "cached", attribution });
    expect(weatherFetch).toHaveBeenCalledTimes(2);
    const [geocodingUrl, forecastUrl] = weatherFetch.mock.calls.map(([input]) => new URL(String(input)));
    expect(geocodingUrl.href).toContain("https://geocoding-api.open-meteo.com/v1/search?");
    expect(geocodingUrl.searchParams.get("name")).toBe("Sydney, Australia");
    expect(forecastUrl.href).toContain("https://api.open-meteo.com/v1/forecast?");
    expect(forecastUrl.searchParams.get("daily")).toContain("temperature_2m_max");
    await expect(env.DB.prepare(
      "SELECT used_count FROM weather_provider_usage WHERE billing_month = '2026-08'"
    ).first()).resolves.toEqual({ used_count: 2 });
  });

  it("coalesces concurrent cold refreshes into one provider call set", async () => {
    let providerCallCount = 0;
    const weatherFetch = vi.fn<typeof fetch>(async (input) => {
      providerCallCount += 1;
      if (providerCallCount === 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const url = new URL(String(input));
      if (url.hostname === "geocoding-api.open-meteo.com") {
        return geocodingResponse(url.searchParams.get("name") ?? "");
      }
      return url.searchParams.has("daily") ? forecastResponse() : currentResponse();
    });
    const app = createApp({ now: () => initialNow, weatherFetch });

    const responses = await Promise.all([
      app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings()),
      app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings()),
    ]);
    const bodies = await Promise.all(responses.map((item) => item.json() as Promise<WeatherResponse>));

    expect(responses.map((item) => item.status)).toEqual([200, 200]);
    expect(bodies.map((item) => item.status).sort()).toEqual(["cached", "live"]);
    expect(weatherFetch).toHaveBeenCalledTimes(2);
    await expect(env.DB.prepare(
      "SELECT used_count FROM weather_provider_usage WHERE billing_month = '2026-08'"
    ).first()).resolves.toEqual({ used_count: 2 });
  });

  it("coalesces concurrent current-only refreshes while the forecast is fresh", async () => {
    let now = initialNow;
    const weatherFetch = openMeteoFetch();
    weatherFetch.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.hostname === "geocoding-api.open-meteo.com") return geocodingResponse("Sydney, Australia");
      if (!url.searchParams.has("daily")) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return url.searchParams.has("daily") ? forecastResponse() : currentResponse(21);
    });
    const app = createApp({ now: () => now, weatherFetch });

    await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    now = new Date(initialNow.getTime() + 61 * 60 * 1_000);
    const refreshed = await Promise.all([
      app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings()),
      app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings()),
    ]);
    const refreshedBodies = await Promise.all(
      refreshed.map((item) => item.json() as Promise<WeatherResponse>)
    );

    expect(refreshed.map((item) => item.status)).toEqual([200, 200]);
    expect(refreshedBodies.map((item) => item.status).sort()).toEqual(["cached", "live"]);
    const liveBody = refreshedBodies.find((item) => item.status === "live");
    expect(liveBody).toMatchObject({
      status: "live",
      weather: { temperatureC: 21, condition: "흐림" },
    });
    expect(liveBody?.weather).not.toBeNull();
    if (!liveBody?.weather) throw new Error("Expected a weather snapshot");
    expect(liveBody.weather.forecast).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2026-08-12" }),
    ]));
    expect(weatherFetch).toHaveBeenCalledTimes(3);
    expect(new URL(String(weatherFetch.mock.calls[2]?.[0])).hostname).toBe("api.open-meteo.com");
    await expect(env.DB.prepare(
      "SELECT used_count FROM weather_provider_usage WHERE billing_month = '2026-08'"
    ).first()).resolves.toEqual({ used_count: 3 });
  });

  it("full-refreshes with a new geocoding lookup when the trip destination changes", async () => {
    const weatherFetch = openMeteoFetch();
    const app = createApp({ now: () => initialNow, weatherFetch });

    await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    await env.DB.prepare("UPDATE trips SET destination = 'Melbourne, Australia' WHERE id = 'trip-weather'").run();
    const second = await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());

    expect(second.status).toBe(200);
    expect(weatherFetch.mock.calls.map(([input]) => new URL(String(input)).hostname)).toEqual([
      "geocoding-api.open-meteo.com", "api.open-meteo.com",
      "geocoding-api.open-meteo.com", "api.open-meteo.com",
    ]);
    expect(new URL(String(weatherFetch.mock.calls[2]?.[0])).searchParams.get("name"))
      .toBe("Melbourne, Australia");
  });

  it("rejects a full refresh when its two provider calls cannot fit in the product monthly limit", async () => {
    await env.DB.prepare(
      "INSERT INTO weather_provider_usage (billing_month, used_count, updated_at) VALUES ('2026-08', 9999, ?)"
    ).bind(initialNow.toISOString()).run();
    const weatherFetch = openMeteoFetch();
    const app = createApp({ now: () => initialNow, weatherFetch });

    const response = await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "WEATHER_FREE_LIMIT_REACHED" } });
    expect(weatherFetch).not.toHaveBeenCalled();
  });

  it("reserves both cold-refresh calls atomically at the remaining limit", async () => {
    await env.DB.prepare(
      "INSERT INTO weather_provider_usage (billing_month, used_count, updated_at) VALUES ('2026-08', 9998, ?)"
    ).bind(initialNow.toISOString()).run();
    const weatherFetch = openMeteoFetch();
    const app = createApp({ now: () => initialNow, weatherFetch });

    const response = await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());

    expect(response.status).toBe(200);
    await expect(env.DB.prepare(
      "SELECT used_count FROM weather_provider_usage WHERE billing_month = '2026-08'"
    ).first()).resolves.toEqual({ used_count: 10000 });
  });

  it("maps malformed geocoding, malformed daily data, network failures, and timeouts to the provider error contract", async () => {
    const malformedGeocoding = vi.fn<typeof fetch>(async () => Response.json({ results: [] }));
    const malformedApp = createApp({ now: () => initialNow, weatherFetch: malformedGeocoding });
    const malformed = await malformedApp.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    expect(malformed.status).toBe(502);

    const networkApp = createApp({
      now: () => initialNow,
      weatherFetch: vi.fn<typeof fetch>(async () => { throw new TypeError("network unavailable"); }),
    });
    const network = await networkApp.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
    expect(network.status).toBe(502);

    vi.useFakeTimers();
    try {
      let providerStartedResolve!: () => void;
      const providerStarted = new Promise<void>((resolve) => { providerStartedResolve = resolve; });
      const timedOutApp = createApp({
        now: () => initialNow,
        weatherFetch: vi.fn<typeof fetch>(async (_input, init) => {
          providerStartedResolve();
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject({ name: "AbortError" }), { once: true });
          });
        }),
      });
      const pending = timedOutApp.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());
      await providerStarted;
      await vi.advanceTimersByTimeAsync(10_000);
      expect((await pending).status).toBe(502);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps weather snapshots until their exact expiry boundary", async () => {
    const app = createApp({ now: () => initialNow, weatherFetch: openMeteoFetch() });
    await app.request("http://localhost/api/trips/trip-weather/weather", { headers: headers() }, bindings());

    const earlyChanges = await purgeExpiredWeatherSnapshots(env.DB, new Date(initialNow.getTime() + 59 * 60 * 1_000).toISOString());
    const currentDueChanges = await purgeExpiredWeatherSnapshots(env.DB, new Date(initialNow.getTime() + 60 * 60 * 1_000).toISOString());
    const forecastDueChanges = await purgeExpiredWeatherSnapshots(env.DB, new Date(initialNow.getTime() + FORECAST_CACHE_MS).toISOString());

    expect(earlyChanges).toBe(0);
    expect(currentDueChanges).toBe(1);
    expect(forecastDueChanges).toBe(1);
  });
});
