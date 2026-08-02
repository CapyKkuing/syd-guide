import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { AppDependencies } from "../auth/access";
import { requirePrincipal } from "../auth/principal";
import {
  listPlaceProviderUsage,
  reservePlaceProviderUsage,
} from "../db/place-provider";
import { findTripForMember } from "../db/trips";
import type { AppEnv } from "../env";
import {
  getGooglePlace,
  getGooglePlacePhoto,
  GooglePlacesProviderError,
  searchGooglePlace,
  type GooglePlacesFetch,
} from "../services/google-places";

export class PlacesError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const idSchema = z.string().regex(/^[A-Za-z0-9-]{1,100}$/);
const photoNameSchema = z.string().max(500)
  .regex(/^places\/[^/]+\/photos\/[^/]+$/);

interface PlaceLookupRow {
  name: string;
  provider_place_id: string | null;
  center_latitude: number | null;
  center_longitude: number | null;
}

export function registerPlacesRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies,
  placesFetch: GooglePlacesFetch = fetch
) {
  app.get("/api/trips/:id/places/:placeId/discovery", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = validId(c.req.param("id"), "TRIP_ID_INVALID");
    const placeId = validId(c.req.param("placeId"), "PLACE_ID_INVALID");
    const trip = await findTripForMember(c.env, tripId, principal.memberId);
    if (!trip || trip.deletedAt) {
      throw new PlacesError(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
    }
    const place = await findPlace(c.env, tripId, placeId);
    const apiKey = configuredApiKey(c.env);
    const sku = place.provider_place_id
      ? "place-details-enterprise" as const
      : "text-search-enterprise" as const;
    if (!await reservePlaceProviderUsage(c.env, sku, dependencies.now())) {
      throw new PlacesError(
        429,
        "PLACES_FREE_LIMIT_REACHED",
        "이번 달 무료 보호 한도에 도달했습니다. 직접 입력 정보는 계속 사용할 수 있습니다."
      );
    }
    try {
      const details = place.provider_place_id
        ? await getGooglePlace(apiKey, place.provider_place_id, placesFetch)
        : await searchGooglePlace(
          apiKey,
          `${place.name} ${trip.destination}`,
          placesFetch,
          place.center_latitude !== null && place.center_longitude !== null
            ? { latitude: place.center_latitude, longitude: place.center_longitude }
            : undefined,
          place.name
        );
      c.header("Cache-Control", "private, no-store");
      return c.json({
        details,
        usage: await listPlaceProviderUsage(c.env, dependencies.now()),
      });
    } catch (error) {
      providerError(error);
    }
  });

  app.get("/api/trips/:id/places/:placeId/photo", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = validId(c.req.param("id"), "TRIP_ID_INVALID");
    const placeId = validId(c.req.param("placeId"), "PLACE_ID_INVALID");
    const trip = await findTripForMember(c.env, tripId, principal.memberId);
    if (!trip || trip.deletedAt) {
      throw new PlacesError(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
    }
    const place = await findPlace(c.env, tripId, placeId);
    const name = photoNameSchema.safeParse(c.req.query("name"));
    if (!name.success) {
      throw new PlacesError(400, "PLACE_PHOTO_INVALID", "장소 사진 정보가 올바르지 않습니다.");
    }
    const providerPlaceId = name.data.split("/")[1];
    if (place.provider_place_id && place.provider_place_id !== providerPlaceId) {
      throw new PlacesError(400, "PLACE_PHOTO_MISMATCH", "장소와 사진 정보가 일치하지 않습니다.");
    }
    const apiKey = configuredApiKey(c.env);
    if (!await reservePlaceProviderUsage(c.env, "place-photo", dependencies.now())) {
      throw new PlacesError(
        429,
        "PLACES_FREE_LIMIT_REACHED",
        "이번 달 사진 무료 보호 한도에 도달했습니다."
      );
    }
    try {
      const photo = await getGooglePlacePhoto(
        apiKey,
        name.data,
        placesFetch
      );
      return new Response(photo.body, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": photo.headers.get("Content-Type") ?? "image/jpeg",
        },
      });
    } catch (error) {
      providerError(error);
    }
  });
}

async function findPlace(env: AppEnv["Bindings"], tripId: string, placeId: string) {
  const place = await env.DB.prepare(
    `SELECT name, provider_place_id,
      (SELECT AVG(latitude) FROM places WHERE trip_id = ? AND latitude IS NOT NULL) AS center_latitude,
      (SELECT AVG(longitude) FROM places WHERE trip_id = ? AND longitude IS NOT NULL) AS center_longitude
     FROM places WHERE trip_id = ? AND id = ?`
  ).bind(tripId, tripId, tripId, placeId).first<PlaceLookupRow>();
  if (!place) {
    throw new PlacesError(404, "PLACE_NOT_FOUND", "장소를 찾을 수 없습니다.");
  }
  return place;
}

function configuredApiKey(env: AppEnv["Bindings"]): string {
  if (!env.GOOGLE_PLACES_API_KEY) {
    throw new PlacesError(
      503,
      "PLACES_NOT_CONFIGURED",
      "Google Places 연결 전입니다. 직접 입력 정보는 계속 사용할 수 있습니다."
    );
  }
  return env.GOOGLE_PLACES_API_KEY;
}

function validId(value: string, code: string): string {
  if (!idSchema.safeParse(value).success) {
    throw new PlacesError(400, code, "요청한 ID가 올바르지 않습니다.");
  }
  return value;
}

function providerError(error: unknown): never {
  if (error instanceof PlacesError) throw error;
  if (error instanceof GooglePlacesProviderError) {
    throw new PlacesError(
      502,
      "PLACES_PROVIDER_ERROR",
      "Google Places 정보를 불러오지 못했습니다. 직접 입력 정보는 계속 사용할 수 있습니다."
    );
  }
  throw error;
}
