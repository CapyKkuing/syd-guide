import { z } from "zod";
import type { WeatherForecastDay, WeatherSnapshot } from "../../src/shared/weather";
import type { Env } from "../env";

export const WEATHER_MONTHLY_LIMIT = 10_000;
export const CURRENT_CACHE_MS = 60 * 60 * 1_000;
export const FORECAST_CACHE_MS = 24 * 60 * 60 * 1_000;
export const WEATHER_REFRESH_LEASE_MS = 25 * 1_000;

const forecastSchema = z.array(z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  condition: z.string().min(1),
  conditionCode: z.number().int(),
  maxTemperatureC: z.number(),
  minTemperatureC: z.number(),
}));

type CurrentWeatherRow = {
  query: string;
  location_name: string;
  latitude: number;
  longitude: number;
  time_zone: string;
  condition: string;
  condition_code: number;
  temperature_c: number;
  uv_index: number;
  observed_at: string;
  fetched_at: string;
  expires_at: string;
};

type ForecastWeatherRow = {
  query: string;
  forecast_json: string;
  fetched_at: string;
  expires_at: string;
};

export type StoredWeather = {
  current: WeatherSnapshot | null;
  currentQuery: string | null;
  currentExpiresAt: string | null;
  forecast: WeatherForecastDay[];
  forecastQuery: string | null;
  forecastExpiresAt: string | null;
};

type SavedWeather = Omit<StoredWeather, "current"> & {
  current: WeatherSnapshot;
};

export async function reserveWeatherProviderUsage(
  env: Env,
  now: Date,
  requestCount = 1,
): Promise<boolean> {
  if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > WEATHER_MONTHLY_LIMIT) {
    throw new Error("Weather provider request count is invalid");
  }
  const row = await env.DB.prepare(
    `INSERT INTO weather_provider_usage (billing_month, used_count, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (billing_month) DO UPDATE SET
       used_count = used_count + excluded.used_count,
       updated_at = excluded.updated_at
     WHERE used_count <= ? - excluded.used_count
     RETURNING used_count`
  ).bind(billingMonth(now), requestCount, now.toISOString(), WEATHER_MONTHLY_LIMIT)
    .first<{ used_count: number }>();
  return row !== null;
}

export async function acquireWeatherRefreshLease(
  env: Env,
  tripId: string,
  now: Date,
): Promise<string | null> {
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + WEATHER_REFRESH_LEASE_MS).toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO weather_refresh_leases (trip_id, lease_token, lease_expires_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (trip_id) DO UPDATE SET
       lease_token = excluded.lease_token,
       lease_expires_at = excluded.lease_expires_at,
       updated_at = excluded.updated_at
     WHERE weather_refresh_leases.lease_expires_at <= excluded.updated_at
     RETURNING lease_token`
  ).bind(tripId, leaseToken, leaseExpiresAt, now.toISOString())
    .first<{ lease_token: string }>();
  return row?.lease_token === leaseToken ? leaseToken : null;
}

export async function releaseWeatherRefreshLease(
  env: Env,
  tripId: string,
  leaseToken: string,
): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM weather_refresh_leases WHERE trip_id = ? AND lease_token = ?"
  ).bind(tripId, leaseToken).run();
}

export async function loadWeatherSnapshot(env: Env, tripId: string): Promise<StoredWeather | null> {
  const [currentRow, forecastRow] = await Promise.all([
    env.DB.prepare(
      `SELECT query, location_name, latitude, longitude, time_zone,
        condition, condition_code, temperature_c, uv_index, observed_at,
        fetched_at, expires_at
       FROM weather_current_snapshots WHERE trip_id = ?`
    ).bind(tripId).first<CurrentWeatherRow>(),
    env.DB.prepare(
      `SELECT query, forecast_json, fetched_at, expires_at
       FROM weather_forecast_snapshots WHERE trip_id = ?`
    ).bind(tripId).first<ForecastWeatherRow>(),
  ]);

  if (!currentRow && !forecastRow) return null;

  let forecast: WeatherForecastDay[] = [];
  let forecastQuery: string | null = null;
  let forecastExpiresAt: string | null = null;
  if (forecastRow) {
    try {
      const parsed = forecastSchema.safeParse(JSON.parse(forecastRow.forecast_json));
      if (parsed.success) {
        forecast = parsed.data;
        forecastQuery = forecastRow.query;
        forecastExpiresAt = forecastRow.expires_at;
      }
    } catch {
      forecast = [];
    }
  }

  return {
    current: currentRow ? {
      location: {
        name: currentRow.location_name,
        latitude: Number(currentRow.latitude),
        longitude: Number(currentRow.longitude),
        timeZone: currentRow.time_zone,
      },
      condition: currentRow.condition,
      conditionCode: Number(currentRow.condition_code),
      temperatureC: Number(currentRow.temperature_c),
      uvIndex: Number(currentRow.uv_index),
      observedAt: currentRow.observed_at,
      fetchedAt: currentRow.fetched_at,
      forecast,
    } : null,
    currentQuery: currentRow?.query ?? null,
    currentExpiresAt: currentRow?.expires_at ?? null,
    forecast,
    forecastQuery,
    forecastExpiresAt,
  };
}

export async function saveWeatherSnapshot(
  env: Env,
  tripId: string,
  snapshot: WeatherSnapshot,
  now: Date,
  options: { refreshForecast: boolean; query: string },
): Promise<SavedWeather> {
  const query = normalizeWeatherQuery(options.query);
  const currentExpiresAt = new Date(now.getTime() + CURRENT_CACHE_MS).toISOString();
  const forecastExpiresAt = new Date(now.getTime() + FORECAST_CACHE_MS).toISOString();
  const currentStatement = env.DB.prepare(
    `INSERT INTO weather_current_snapshots (
      trip_id, query, location_name, latitude, longitude, time_zone,
      condition, condition_code, temperature_c, uv_index,
      observed_at, fetched_at, expires_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (trip_id) DO UPDATE SET
      query = excluded.query,
      location_name = excluded.location_name,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      time_zone = excluded.time_zone,
      condition = excluded.condition,
      condition_code = excluded.condition_code,
      temperature_c = excluded.temperature_c,
      uv_index = excluded.uv_index,
      observed_at = excluded.observed_at,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at`
  ).bind(
    tripId,
    query,
    snapshot.location.name,
    snapshot.location.latitude,
    snapshot.location.longitude,
    snapshot.location.timeZone,
    snapshot.condition,
    snapshot.conditionCode,
    snapshot.temperatureC,
    snapshot.uvIndex,
    snapshot.observedAt,
    snapshot.fetchedAt,
    currentExpiresAt,
    now.toISOString(),
  );

  if (options.refreshForecast) {
    const forecastStatement = env.DB.prepare(
      `INSERT INTO weather_forecast_snapshots (
        trip_id, query, forecast_json, fetched_at, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (trip_id) DO UPDATE SET
        query = excluded.query,
        forecast_json = excluded.forecast_json,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`
    ).bind(
      tripId,
      query,
      JSON.stringify(snapshot.forecast),
      snapshot.fetchedAt,
      forecastExpiresAt,
      now.toISOString(),
    );
    await env.DB.batch([currentStatement, forecastStatement]);
    return {
      current: snapshot,
      currentQuery: query,
      currentExpiresAt,
      forecast: snapshot.forecast,
      forecastQuery: query,
      forecastExpiresAt,
    };
  }

  const existing = await loadWeatherSnapshot(env, tripId);
  if (!existing || !existing.forecastExpiresAt) {
    throw new Error("Current weather cannot be stored without an existing forecast");
  }
  await env.DB.batch([currentStatement]);
  const current = { ...snapshot, forecast: existing.forecast };
  return {
    current,
    currentQuery: query,
    currentExpiresAt,
    forecast: existing.forecast,
    forecastQuery: existing.forecastQuery,
    forecastExpiresAt: existing.forecastExpiresAt,
  };
}

export function hasFreshCurrent(value: StoredWeather, now: Date, query: string): boolean {
  return Boolean(
    value.current &&
    value.currentQuery === normalizeWeatherQuery(query) &&
    value.currentExpiresAt &&
    Date.parse(value.currentExpiresAt) > now.getTime()
  );
}

export function hasFreshForecast(value: StoredWeather, now: Date, query: string): boolean {
  return Boolean(
    value.forecastQuery === normalizeWeatherQuery(query) &&
    value.forecastExpiresAt &&
    Date.parse(value.forecastExpiresAt) > now.getTime()
  );
}

export function normalizeWeatherQuery(query: string): string {
  return query.trim();
}

function billingMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}
