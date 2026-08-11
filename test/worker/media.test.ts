import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import type { Env } from "../../worker/env";
import type { Trip } from "../../src/shared/entities";

const now = new Date("2026-07-29T00:00:00.000Z");
const app = createApp({ now: () => now });

function bindings(): Env {
  return {
    ...env,
    SURFACE: "admin",
    APP_ORIGIN: "http://localhost",
    PARTNER_ORIGIN: "http://localhost",
    DEV_AUTH: "enabled",
    GOOGLE_DRIVE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
  };
}

function headers(role: "owner" | "partner", json = false): Headers {
  const result = new Headers({
    Origin: "http://localhost",
    "X-Dev-Principal": role,
  });
  if (json) result.set("Content-Type", "application/json");
  return result;
}

function request(
  role: "owner" | "partner",
  path: string,
  init: RequestInit = {}
) {
  return app.request(
    `http://localhost${path}`,
    { ...init, headers: init.headers ?? headers(role) },
    bindings()
  );
}

async function createTrip(): Promise<Trip> {
  const response = await request("owner", "/api/trips", {
    method: "POST",
    headers: headers("owner", true),
    body: JSON.stringify({
      title: "시드니 여행",
      destination: "Sydney, Australia",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      timeZone: "Australia/Sydney",
      status: "completed",
      coverImageUrl: "/images/sydney_harbour_bridge.jpg",
    }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { trip: Trip }).trip;
}

describe("private trip media API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM trips").run();
  });

  it("keeps Drive identifiers provider-neutral in the snapshot and selects a representative", async () => {
    const trip = await createTrip();
    const config = await request("owner", `/api/trips/${trip.id}/media/config`, {
      headers: headers("owner"),
    });
    await expect(config.json()).resolves.toEqual({
      provider: "google-drive",
      clientId: "test-client-id.apps.googleusercontent.com",
    });

    const connected = await request("owner", `/api/trips/${trip.id}/media/storage`, {
      method: "PUT",
      headers: headers("owner", true),
      body: JSON.stringify({
        provider: "google-drive",
        rootObjectId: "folder_12345",
      }),
    });
    expect(connected.status).toBe(200);

    const registered = await request("partner", `/api/trips/${trip.id}/media`, {
      method: "POST",
      headers: headers("partner", true),
      body: JSON.stringify({
        provider: "google-drive",
        providerObjectId: "photo_12345",
        thumbnailObjectId: "thumb_12345",
        originalName: "harbour.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        capturedAt: "2026-08-02T09:20:00+10:00",
        aiScore: 0.91,
        aiLabels: ["harbor"],
      }),
    });
    expect(registered.status).toBe(201);
    const mediaId = ((await registered.json()) as {
      media: { id: string };
    }).media.id;

    const selected = await request(
      "partner",
      `/api/trips/${trip.id}/media/representative`,
      {
        method: "PATCH",
        headers: headers("partner", true),
        body: JSON.stringify({ mediaId }),
      }
    );
    expect(selected.status).toBe(200);

    const preview = await request(
      "partner",
      `/api/trips/${trip.id}/media/${mediaId}/preview`,
      {
        method: "PATCH",
        headers: headers("partner", true),
        body: JSON.stringify({
          previewCropAspect: "1:1",
          previewBrightness: 8,
        }),
      }
    );
    expect(preview.status).toBe(200);
    await expect(preview.json()).resolves.toMatchObject({
      media: {
        id: mediaId,
        previewCropAspect: "1:1",
        previewBrightness: 8,
      },
    });

    const snapshot = await request("owner", `/api/trips/${trip.id}/snapshot`, {
      headers: headers("owner"),
    });
    await expect(snapshot.json()).resolves.toMatchObject({
      trip: { representativeMediaId: mediaId },
      mediaStorage: {
        provider: "google-drive",
        rootObjectId: "folder_12345",
      },
      media: [{
        id: mediaId,
        provider: "google-drive",
        providerObjectId: "photo_12345",
        thumbnailObjectId: "thumb_12345",
        capturedAt: "2026-08-02T09:20:00+10:00",
        aiScore: 0.91,
        aiLabels: ["harbor"],
        previewCropAspect: "1:1",
        previewBrightness: 8,
      }],
    });

    const retained = await request("partner", `/api/trips/${trip.id}/media`, {
      method: "POST",
      headers: headers("partner", true),
      body: JSON.stringify({
        provider: "google-drive",
        providerObjectId: "photo_retained",
        thumbnailObjectId: "thumb_retained",
        originalName: "opera-house.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        capturedAt: "2026-08-02T10:00:00+10:00",
        aiScore: 0.82,
        aiLabels: ["opera-house"],
      }),
    });
    expect(retained.status).toBe(201);
    const retainedMediaId = ((await retained.json()) as {
      media: { id: string };
    }).media.id;

    const removed = await request(
      "partner",
      `/api/trips/${trip.id}/media/${mediaId}`,
      {
        method: "DELETE",
        headers: headers("partner"),
      }
    );
    expect(removed.status).toBe(204);

    const afterRemoval = await request("owner", `/api/trips/${trip.id}/snapshot`, {
      headers: headers("owner"),
    });
    await expect(afterRemoval.json()).resolves.toMatchObject({
      trip: { representativeMediaId: null },
      mediaStorage: {
        provider: "google-drive",
        rootObjectId: "folder_12345",
      },
      media: [{
        id: retainedMediaId,
        providerObjectId: "photo_retained",
        thumbnailObjectId: "thumb_retained",
      }],
    });
  });

  it("rejects an invalid EXIF offset before creating media", async () => {
    const trip = await createTrip();
    await request("owner", `/api/trips/${trip.id}/media/storage`, {
      method: "PUT",
      headers: headers("owner", true),
      body: JSON.stringify({
        provider: "google-drive",
        rootObjectId: "folder_12345",
      }),
    });

    const response = await request("partner", `/api/trips/${trip.id}/media`, {
      method: "POST",
      headers: headers("partner", true),
      body: JSON.stringify({
        provider: "google-drive",
        providerObjectId: "photo_12345",
        thumbnailObjectId: "thumb_12345",
        originalName: "invalid-offset.jpg",
        mimeType: "image/jpeg",
        width: 1600,
        height: 900,
        capturedAt: "2026-08-02T09:20:00+24:00",
        aiScore: null,
        aiLabels: [],
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MEDIA_INPUT_INVALID" },
    });
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS media_count FROM trip_media WHERE trip_id = ?"
    )
      .bind(trip.id)
      .first<{ media_count: number }>();
    expect(row?.media_count).toBe(0);
  });

  it("allows only the owner to establish the shared Drive folder", async () => {
    const trip = await createTrip();

    const response = await request("partner", `/api/trips/${trip.id}/media/storage`, {
      method: "PUT",
      headers: headers("partner", true),
      body: JSON.stringify({
        provider: "google-drive",
        rootObjectId: "folder_12345",
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MEDIA_STORAGE_OWNER_REQUIRED" },
    });
  });

  it("stores a separate booking document folder for Reservations/trip-id", async () => {
    const trip = await createTrip();

    const empty = await request(
      "owner",
      `/api/trips/${trip.id}/media/booking-storage`,
      { headers: headers("owner") }
    );
    await expect(empty.json()).resolves.toEqual({ storage: null });

    const saved = await request(
      "owner",
      `/api/trips/${trip.id}/media/booking-storage`,
      {
        method: "PUT",
        headers: headers("owner", true),
        body: JSON.stringify({
          provider: "google-drive",
          rootObjectId: "booking_folder_12345",
        }),
      }
    );
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      storage: {
        tripId: trip.id,
        provider: "google-drive",
        rootObjectId: "booking_folder_12345",
      },
    });

    const partnerOverwrite = await request(
      "partner",
      `/api/trips/${trip.id}/media/booking-storage`,
      {
        method: "PUT",
        headers: headers("partner", true),
        body: JSON.stringify({
          provider: "google-drive",
          rootObjectId: "partner_folder_12345",
        }),
      }
    );
    expect(partnerOverwrite.status).toBe(403);
    await expect(partnerOverwrite.json()).resolves.toMatchObject({
      error: { code: "BOOKING_STORAGE_OWNER_REQUIRED" },
    });
  });
});
