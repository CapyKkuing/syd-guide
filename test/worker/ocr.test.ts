import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import type { Env } from "../../worker/env";

const now = new Date("2026-08-08T00:00:00.000Z");

function bindings(configured = true): Env {
  return {
    ...env,
    SURFACE: "partner",
    APP_ORIGIN: "http://localhost",
    PARTNER_ORIGIN: "http://localhost",
    DEV_AUTH: "enabled",
    GOOGLE_VISION_CLIENT_EMAIL: configured ? "vision@example.test" : undefined,
    GOOGLE_VISION_PRIVATE_KEY: configured ? "test-private-key" : undefined,
    GOOGLE_VISION_PROJECT_ID: configured ? "test-project" : undefined,
  };
}

async function seedTrip() {
  await env.DB.prepare(
    `INSERT INTO trips (
      id, title, destination, start_date, end_date, time_zone, status,
      version, sync_version, created_by, updated_by, created_at, updated_at
    ) VALUES ('trip-ocr', '시드니 여행', 'Sydney', '2026-10-08', '2026-10-12',
      'Australia/Sydney', 'active', 1, 0, 'owner', 'owner', ?, ?)`
  ).bind(now.toISOString(), now.toISOString()).run();
  await env.DB.prepare(
    "INSERT INTO trip_members (trip_id, member_id, joined_at) VALUES ('trip-ocr', 'owner', ?)"
  ).bind(now.toISOString()).run();
}

function request(file: File, customBindings = bindings(), app = createApp()) {
  const form = new FormData();
  form.set("file", file);
  return app.request(
    "http://localhost/api/trips/trip-ocr/ocr/booking",
    {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        "X-Dev-Principal": "owner",
      },
      body: form,
    },
    customBindings
  );
}

describe("booking OCR", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM trips").run();
    await env.DB.prepare("DELETE FROM vision_ocr_usage").run();
    await seedTrip();
  });

  it("returns an editable booking draft and reserves one image page", async () => {
    const visionFetch = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-token");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        requests: [{ features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }],
      });
      return Response.json({
        responses: [{
          fullTextAnnotation: {
            text: "Qantas Airways\nBOARDING PASS\nBooking reference: QF7ABC\n2026-10-08 09:30",
          },
        }],
      });
    });
    const app = createApp({
      now: () => now,
      visionFetch,
      visionTokenProvider: async () => "test-token",
    });

    const response = await request(
      new File(["ticket"], "ticket.jpg", { type: "image/jpeg" }),
      bindings(),
      app
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: {
        bookingType: "flight",
        provider: "Qantas Airways",
        reservationCode: "QF7ABC",
        startsAt: "2026-10-08T09:30",
      },
      usage: { used: 1, limit: 800 },
    });
    expect(visionFetch).toHaveBeenCalledOnce();
  });

  it("returns an editable PDF draft and reserves the five requested pages", async () => {
    const visionFetch = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe("https://vision.googleapis.com/v1/files:annotate");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        requests: [{
          inputConfig: { mimeType: "application/pdf" },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: [1, 2, 3, 4, 5],
        }],
      });
      return Response.json({
        responses: [{
          responses: [{
            fullTextAnnotation: {
              text: "Sydney Hotel\nConfirmation code: STAY7\n2026-10-08 15:00",
            },
          }],
        }],
      });
    });
    const app = createApp({
      now: () => now,
      visionFetch,
      visionTokenProvider: async () => "test-token",
    });

    const response = await request(
      new File(["voucher"], "voucher.pdf", { type: "application/pdf" }),
      bindings(),
      app
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      draft: {
        bookingType: "lodging",
        provider: "Sydney Hotel",
        reservationCode: "STAY7",
        startsAt: "2026-10-08T15:00",
      },
      usage: { used: 5, limit: 800 },
    });
    expect(visionFetch).toHaveBeenCalledOnce();
  });

  it("blocks provider calls at the monthly page hard limit", async () => {
    await env.DB.prepare(
      "INSERT INTO vision_ocr_usage (billing_month, used_pages, updated_at) VALUES ('2026-08', 800, ?)"
    ).bind(now.toISOString()).run();
    const visionFetch = vi.fn<typeof fetch>();
    const app = createApp({
      now: () => now,
      visionFetch,
      visionTokenProvider: async () => "test-token",
    });

    const response = await request(
      new File(["ticket"], "ticket.jpg", { type: "image/jpeg" }),
      bindings(),
      app
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "OCR_FREE_LIMIT_REACHED" },
    });
    expect(visionFetch).not.toHaveBeenCalled();
  });

  it("keeps manual entry available when Vision is not configured", async () => {
    const response = await request(
      new File(["ticket"], "ticket.jpg", { type: "image/jpeg" }),
      bindings(false)
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "OCR_NOT_CONFIGURED",
        message: expect.stringContaining("직접 입력"),
      },
    });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM vision_ocr_usage"
    ).first()).resolves.toEqual({ count: 0 });
  });
});
