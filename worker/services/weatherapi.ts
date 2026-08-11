import { z } from "zod";
import type { WeatherForecastDay, WeatherSnapshot } from "../../src/shared/weather";

const conditionSchema = z.object({
  text: z.string().min(1),
  code: z.number().int(),
});

const currentSchema = z.object({
  last_updated_epoch: z.number().int().positive(),
  temp_c: z.number(),
  uv: z.number().nonnegative(),
  condition: conditionSchema,
});

const locationSchema = z.object({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  tz_id: z.string().min(1),
});

const forecastDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z.object({
    maxtemp_c: z.number(),
    mintemp_c: z.number(),
    condition: conditionSchema,
  }),
});

const currentResponseSchema = z.object({
  location: locationSchema,
  current: currentSchema,
});

const forecastResponseSchema = currentResponseSchema.extend({
  forecast: z.object({ forecastday: z.array(forecastDaySchema).min(1) }),
});

const WEATHER_API_TIMEOUT_MS = 10_000;

export type WeatherApiFetch = typeof fetch;

export class WeatherApiProviderError extends Error {
  constructor(readonly status: number) {
    super("WeatherAPI request failed");
  }
}

export async function fetchWeatherForecast(
  apiKey: string,
  query: string,
  fetchedAt: Date,
  fetcher: WeatherApiFetch,
): Promise<WeatherSnapshot> {
  const response = await fetchWithTimeout(fetcher, endpoint("forecast.json", apiKey, query, {
    days: "3", aqi: "no", alerts: "no", lang: "ko",
  }));
  if (!response.ok) throw new WeatherApiProviderError(response.status);
  const parsed = forecastResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new WeatherApiProviderError(502);
  return toSnapshot(parsed.data.location, parsed.data.current, fetchedAt, parsed.data.forecast.forecastday);
}

export async function fetchCurrentWeather(
  apiKey: string,
  query: string,
  fetchedAt: Date,
  fetcher: WeatherApiFetch,
): Promise<Omit<WeatherSnapshot, "forecast">> {
  const response = await fetchWithTimeout(fetcher, endpoint("current.json", apiKey, query, {
    aqi: "no", lang: "ko",
  }));
  if (!response.ok) throw new WeatherApiProviderError(response.status);
  const parsed = currentResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new WeatherApiProviderError(502);
  const current = toSnapshot(parsed.data.location, parsed.data.current, fetchedAt, []);
  return current;
}

async function fetchWithTimeout(fetcher: WeatherApiFetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_API_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (controller.signal.aborted) throw new WeatherApiProviderError(504);
    return response;
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new WeatherApiProviderError(504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function endpoint(
  path: "current.json" | "forecast.json",
  apiKey: string,
  query: string,
  params: Record<string, string>,
): string {
  const search = new URLSearchParams({ key: apiKey, q: query, ...params });
  return `https://api.weatherapi.com/v1/${path}?${search.toString()}`;
}

function toSnapshot(
  location: z.output<typeof locationSchema>,
  current: z.output<typeof currentSchema>,
  fetchedAt: Date,
  forecast: z.output<typeof forecastDaySchema>[],
): WeatherSnapshot {
  const observedAt = new Date(current.last_updated_epoch * 1_000);
  if (!Number.isFinite(observedAt.getTime())) {
    throw new WeatherApiProviderError(502);
  }
  return {
    location: {
      name: location.name,
      latitude: location.lat,
      longitude: location.lon,
      timeZone: location.tz_id,
    },
    condition: current.condition.text,
    conditionCode: current.condition.code,
    temperatureC: current.temp_c,
    uvIndex: current.uv,
    observedAt: observedAt.toISOString(),
    fetchedAt: fetchedAt.toISOString(),
    forecast: forecast.map((day): WeatherForecastDay => ({
      date: day.date,
      condition: day.day.condition.text,
      conditionCode: day.day.condition.code,
      maxTemperatureC: day.day.maxtemp_c,
      minTemperatureC: day.day.mintemp_c,
    })),
  };
}
