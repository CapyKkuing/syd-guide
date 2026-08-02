import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import type { Env } from "../../worker/env";

const fixedNow = new Date("2026-08-02T00:00:00.000Z");

function bindings(): Env {
  return {
    ...env,
    SURFACE: "partner",
    APP_ORIGIN: "http://localhost",
    PARTNER_ORIGIN: "http://localhost",
    DEV_AUTH: "enabled",
    GOOGLE_PLACES_API_KEY: "test-places-key",
  };
}

function headers(): Headers {
  return new Headers({
    Origin: "http://localhost",
    "X-Dev-Principal": "owner",
  });
}

async function seedPlace(providerPlaceId: string | null = null) {
  await env.DB.prepare(
    `INSERT INTO trips (
      id, title, destination, start_date, end_date, time_zone, status,
      version, sync_version, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'owner', 'owner', ?, ?)`
  ).bind(
    "trip-places",
    "시드니 여행",
    "Sydney, Australia",
    "2026-08-01",
    "2026-08-08",
    "Australia/Sydney",
    "active",
    fixedNow.toISOString(),
    fixedNow.toISOString()
  ).run();
  await env.DB.prepare(
    "INSERT INTO trip_members (trip_id, member_id, joined_at) VALUES (?, 'owner', ?)"
  ).bind("trip-places", fixedNow.toISOString()).run();
  await env.DB.prepare(
    `INSERT INTO places (
      id, trip_id, name, category, status, description, saved_by,
      is_recommended, is_saved, provider, provider_place_id,
      version, updated_by, updated_at
    ) VALUES (?, ?, ?, 'restaurant', 'saved', '', NULL, 1, 0, ?, ?, 1, 'owner', ?)`
  ).bind(
    "place-1",
    "trip-places",
    "Bennelong",
    providerPlaceId ? "google-places" : null,
    providerPlaceId,
    fixedNow.toISOString()
  ).run();
  await env.DB.prepare(
    `UPDATE places SET latitude = -33.8688, longitude = 151.2093
     WHERE id = 'place-1'`
  ).run();
}

describe("Google Places discovery API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM trips").run();
    await env.DB.prepare("DELETE FROM place_provider_usage").run();
  });

  it("returns provider-neutral place data and records one search call", async () => {
    await seedPlace();
    const placesFetch = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("X-Goog-Api-Key")).toBe("test-places-key");
      expect(new Headers(init?.headers).get("X-Goog-FieldMask")).toContain(
        "places.photos"
      );
      expect(JSON.parse(String(init?.body))).toMatchObject({
        locationBias: {
          circle: {
            center: { latitude: -33.8688, longitude: 151.2093 },
            radius: 50000,
          },
        },
      });
      return Response.json({
        places: [{
          id: "google-place-1",
          displayName: { text: "Bennelong" },
          formattedAddress: "Bennelong Point, Sydney NSW",
          location: { latitude: -33.8568, longitude: 151.2153 },
          googleMapsUri: "https://maps.google.com/?cid=1",
          rating: 4.5,
          userRatingCount: 2000,
          currentOpeningHours: { openNow: true, weekdayDescriptions: ["월요일: 휴무"] },
          nationalPhoneNumber: "(02) 9240 8000",
          websiteUri: "https://www.bennelong.com.au/",
          photos: [{
            name: "places/google-place-1/photos/photo-1",
            googleMapsUri: "https://maps.google.com/?cid=1",
            authorAttributions: [{
              displayName: "Bennelong",
              uri: "https://maps.google.com/contrib/1",
            }],
          }],
        }],
      });
    });
    const app = createApp({ now: () => fixedNow, placesFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-places/places/place-1/discovery",
      { headers: headers() },
      bindings()
    );

    expect(response.status).toBe(200);
    const body = await response.json() as {
      details: Record<string, unknown>;
      usage: { sku: string; used: number; limit: number }[];
    };
    expect(body).toMatchObject({
      details: {
        provider: "google-places",
        providerPlaceId: "google-place-1",
        name: "Bennelong",
        rating: 4.5,
        photo: { name: "places/google-place-1/photos/photo-1" },
      },
    });
    expect(body.usage).toContainEqual({
      sku: "text-search-enterprise",
      used: 1,
      limit: 800,
    });
    expect(placesFetch).toHaveBeenCalledOnce();
  });

  it("streams a real photo response without exposing the API key", async () => {
    await seedPlace("google-place-1");
    const placesFetch = vi.fn<typeof fetch>(async () => new Response(
      new Uint8Array([0xff, 0xd8, 0xff]),
      { headers: { "Content-Type": "image/jpeg" } }
    ));
    const app = createApp({ now: () => fixedNow, placesFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-places/places/place-1/photo?name=places%2Fgoogle-place-1%2Fphotos%2Fphoto-1",
      { headers: headers() },
      bindings()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Goog-Api-Key")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0xff, 0xd8, 0xff])
    );
  });

  it("does not link a nearby business when the place name is different", async () => {
    await seedPlace();
    const placesFetch = vi.fn<typeof fetch>(async () => Response.json({
      places: [{
        id: "wrong-place",
        displayName: { text: "KOGI Korean BBQ (Chatswood)" },
        formattedAddress: "Chatswood NSW 2067",
        googleMapsUri: "https://maps.google.com/?cid=2",
        photos: [],
      }],
    }));
    const app = createApp({ now: () => fixedNow, placesFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-places/places/place-1/discovery",
      { headers: headers() },
      bindings()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ details: null });
  });

  it("blocks calls after the monthly hard limit", async () => {
    await seedPlace();
    await env.DB.prepare(
      `INSERT INTO place_provider_usage (billing_month, sku, used_count, updated_at)
       VALUES ('2026-08', 'text-search-enterprise', 800, ?)`
    ).bind(fixedNow.toISOString()).run();
    const placesFetch = vi.fn<typeof fetch>();
    const app = createApp({ now: () => fixedNow, placesFetch });

    const response = await app.request(
      "http://localhost/api/trips/trip-places/places/place-1/discovery",
      { headers: headers() },
      bindings()
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PLACES_FREE_LIMIT_REACHED" },
    });
    expect(placesFetch).not.toHaveBeenCalled();
  });
});
