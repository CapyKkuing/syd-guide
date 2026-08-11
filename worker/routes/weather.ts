import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { WeatherResponse } from "../../src/shared/weather";
import { unavailableWeather, WEATHER_DISCLAIMER } from "../../src/shared/weather";
import type { AppDependencies } from "../auth/access";
import { requirePrincipal } from "../auth/principal";
import {
  hasFreshCurrent,
  hasFreshForecast,
  loadWeatherSnapshot,
  normalizeWeatherQuery,
  reserveWeatherProviderUsage,
  saveWeatherSnapshot,
} from "../db/weather";
import { findTripForMember } from "../db/trips";
import type { AppEnv } from "../env";
import {
  fetchCurrentWeather,
  fetchWeatherForecast,
  type WeatherApiFetch,
  WeatherApiProviderError,
} from "../services/weatherapi";

const idSchema = z.string().regex(/^[A-Za-z0-9-]{1,100}$/);

export class WeatherError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function registerWeatherRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies,
  weatherFetch: WeatherApiFetch = fetch,
) {
  app.get("/api/trips/:id/weather", async (c) => {
    c.header("Cache-Control", "private, no-store");
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    if (!idSchema.safeParse(tripId).success) {
      throw new WeatherError(400, "TRIP_ID_INVALID", "요청한 여행 ID가 올바르지 않습니다.");
    }
    const trip = await findTripForMember(c.env, tripId, principal.memberId);
    if (!trip || trip.deletedAt) {
      throw new WeatherError(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
    }
    const now = dependencies.now();
    const query = normalizeWeatherQuery(trip.destination);
    const cached = await loadWeatherSnapshot(c.env, tripId);
    if (cached && cached.current && hasFreshCurrent(cached, now, query) && hasFreshForecast(cached, now, query)) {
      return response(c, {
        status: "cached",
        weather: cached.current,
        message: null,
        attribution: "WeatherAPI.com",
        disclaimer: WEATHER_DISCLAIMER,
      });
    }
    if (!c.env.WEATHERAPI_KEY && c.env.DEV_AUTH === "enabled") {
      return response(c, unavailableWeather(
        trip.destination,
        "날씨 연결을 준비 중입니다. 여행 일정은 계속 확인할 수 있습니다.",
      ));
    }
    const apiKey = configuredApiKey(c.env);
    if (!await reserveWeatherProviderUsage(c.env, now)) {
      throw new WeatherError(
        429,
        "WEATHER_FREE_LIMIT_REACHED",
        "이번 달 날씨 무료 보호 한도에 도달했습니다. 잠시 후 다시 확인해 주세요.",
      );
    }
    try {
      const stored = cached && hasFreshForecast(cached, now, query)
        ? await saveWeatherSnapshot(
          c.env,
          tripId,
          { ...await fetchCurrentWeather(apiKey, query, now, weatherFetch), forecast: cached.forecast },
          now,
          { refreshForecast: false, query },
        )
        : await saveWeatherSnapshot(
          c.env,
          tripId,
          await fetchWeatherForecast(apiKey, query, now, weatherFetch),
          now,
          { refreshForecast: true, query },
        );
      return response(c, {
        status: "live",
        weather: stored.current,
        message: null,
        attribution: "WeatherAPI.com",
        disclaimer: WEATHER_DISCLAIMER,
      });
    } catch (error) {
      if (error instanceof WeatherApiProviderError || error instanceof TypeError) {
        throw new WeatherError(
          502,
          "WEATHER_PROVIDER_ERROR",
          "현재 날씨 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
      throw error;
    }
  });
}

function configuredApiKey(env: AppEnv["Bindings"]): string {
  if (!env.WEATHERAPI_KEY) {
    throw new WeatherError(
      503,
      "WEATHER_NOT_CONFIGURED",
      "날씨 연결을 준비 중입니다. 여행 일정은 계속 확인할 수 있습니다.",
    );
  }
  return env.WEATHERAPI_KEY;
}

function response(c: Context<AppEnv>, body: WeatherResponse) {
  c.header("Cache-Control", "private, no-store");
  return c.json(body);
}
