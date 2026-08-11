import { z } from "zod";
import type { WeatherForecastDay, WeatherSnapshot } from "../../src/shared/weather";

const locationSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1).optional(),
});

const geocodingResponseSchema = z.object({
  results: z.array(locationSchema).min(1),
});

const currentSchema = z.object({
  temperature_2m: z.number(),
  weather_code: z.number().int(),
  uv_index: z.number().nonnegative().nullable().optional(),
});

const dailySchema = z.object({
  time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  weather_code: z.array(z.number().int()).min(1),
  temperature_2m_max: z.array(z.number()).min(1),
  temperature_2m_min: z.array(z.number()).min(1),
});

const forecastResponseSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
  current: currentSchema,
  daily: dailySchema,
});

const currentResponseSchema = forecastResponseSchema.pick({
  latitude: true,
  longitude: true,
  timezone: true,
  current: true,
});

const WEATHER_PROVIDER_TIMEOUT_MS = 10_000;

export type WeatherProviderFetch = typeof fetch;

export type ResolvedWeatherLocation = {
  name: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

export class OpenMeteoProviderError extends Error {
  constructor(readonly status: number) {
    super("Open-Meteo request failed");
  }
}

export async function resolveWeatherLocation(
  query: string,
  fetcher: WeatherProviderFetch,
): Promise<ResolvedWeatherLocation> {
  const response = await fetchWithTimeout(fetcher, endpoint(
    "https://geocoding-api.open-meteo.com/v1/search",
    { name: query, count: "1", language: "en", format: "json" },
  ));
  if (!response.ok) throw new OpenMeteoProviderError(response.status);
  const parsed = geocodingResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new OpenMeteoProviderError(502);
  const location = parsed.data.results[0];
  return {
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    timeZone: location.timezone ?? "UTC",
  };
}

export async function fetchWeatherForecast(
  location: ResolvedWeatherLocation,
  fetchedAt: Date,
  fetcher: WeatherProviderFetch,
): Promise<WeatherSnapshot> {
  const response = await fetchWithTimeout(fetcher, endpoint(
    "https://api.open-meteo.com/v1/forecast",
    {
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,weather_code,uv_index",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "3",
    },
  ));
  if (!response.ok) throw new OpenMeteoProviderError(response.status);
  const parsed = forecastResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new OpenMeteoProviderError(502);
  return toSnapshot(location.name, parsed.data, fetchedAt);
}

export async function fetchCurrentWeather(
  location: ResolvedWeatherLocation,
  fetchedAt: Date,
  fetcher: WeatherProviderFetch,
): Promise<Omit<WeatherSnapshot, "forecast">> {
  const response = await fetchWithTimeout(fetcher, endpoint(
    "https://api.open-meteo.com/v1/forecast",
    {
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,weather_code,uv_index",
      timezone: "auto",
    },
  ));
  if (!response.ok) throw new OpenMeteoProviderError(response.status);
  const parsed = currentResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new OpenMeteoProviderError(502);
  return toSnapshot(location.name, parsed.data, fetchedAt);
}

async function fetchWithTimeout(fetcher: WeatherProviderFetch, url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { signal: controller.signal });
    if (controller.signal.aborted) throw new OpenMeteoProviderError(504);
    return response;
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new OpenMeteoProviderError(504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function endpoint(base: string, params: Record<string, string>): string {
  return `${base}?${new URLSearchParams(params).toString()}`;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function toSnapshot(
  name: string,
  response: z.output<typeof forecastResponseSchema> | z.output<typeof currentResponseSchema>,
  fetchedAt: Date,
): WeatherSnapshot {
  const forecast = "daily" in response ? toForecast(response.daily) : [];
  return {
    location: {
      name,
      latitude: response.latitude,
      longitude: response.longitude,
      timeZone: response.timezone,
    },
    condition: weatherLabel(response.current.weather_code),
    conditionCode: response.current.weather_code,
    temperatureC: response.current.temperature_2m,
    uvIndex: response.current.uv_index ?? 0,
    observedAt: fetchedAt.toISOString(),
    fetchedAt: fetchedAt.toISOString(),
    forecast,
  };
}

function toForecast(daily: z.output<typeof dailySchema>): WeatherForecastDay[] {
  if (
    daily.time.length !== daily.weather_code.length
    || daily.time.length !== daily.temperature_2m_max.length
    || daily.time.length !== daily.temperature_2m_min.length
  ) {
    throw new OpenMeteoProviderError(502);
  }
  return daily.time.map((date, index) => ({
    date,
    condition: weatherLabel(daily.weather_code[index]),
    conditionCode: daily.weather_code[index],
    maxTemperatureC: daily.temperature_2m_max[index],
    minTemperatureC: daily.temperature_2m_min[index],
  }));
}

function weatherLabel(code: number): string {
  if (code === 0) return "맑음";
  if (code === 1) return "대체로 맑음";
  if (code === 2) return "부분적으로 흐림";
  if (code === 3) return "흐림";
  if (code === 45 || code === 48) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return "날씨 정보";
}
