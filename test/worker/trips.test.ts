import {
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import type { Env } from "../../worker/env";
import worker from "../../worker/index";
import type { Trip } from "../../src/shared/entities";
import type { FlightDetails } from "../../src/shared/flights";

const fixedNow = new Date("2026-07-27T00:00:00.000Z");
const app = createApp({ now: () => fixedNow });

const outboundFlight = {
  airline: "대한항공",
  flightNumber: "KE401",
  departureAirportName: "인천국제공항",
  departureIataCode: "ICN",
  departureTimeZone: "Asia/Seoul",
  scheduledDepartureAt: "2026-09-09T22:00:00+09:00",
  estimatedDepartureAt: "2026-09-09T22:20:00+09:00",
  actualDepartureAt: "2026-09-09T22:30:00+09:00",
  departureTerminal: "2",
  departureGate: "252",
  arrivalAirportName: "시드니 공항",
  arrivalIataCode: "SYD",
  arrivalTimeZone: "Australia/Sydney",
  scheduledArrivalAt: "2026-09-10T09:00:00+10:00",
  estimatedArrivalAt: null,
  actualArrivalAt: null,
  arrivalTerminal: "1",
  arrivalGate: null,
  status: "departed",
} satisfies FlightDetails;

const returnFlight = {
  airline: "대한항공",
  flightNumber: "KE402",
  departureAirportName: "시드니 공항",
  departureIataCode: "SYD",
  departureTimeZone: "Australia/Sydney",
  scheduledDepartureAt: "2026-09-14T09:00:00+10:00",
  estimatedDepartureAt: null,
  actualDepartureAt: null,
  departureTerminal: "1",
  departureGate: null,
  arrivalAirportName: "인천국제공항",
  arrivalIataCode: "ICN",
  arrivalTimeZone: "Asia/Seoul",
  scheduledArrivalAt: "2026-09-14T20:00:00+09:00",
  estimatedArrivalAt: "2026-09-14T20:30:00+09:00",
  actualArrivalAt: null,
  arrivalTerminal: "2",
  arrivalGate: null,
  status: "delayed",
} satisfies FlightDetails;

const validTrip = {
  title: "시드니 여행",
  destination: "Sydney, Australia",
  startDate: "2026-09-10",
  endDate: "2026-09-14",
  timeZone: "Australia/Sydney",
  status: "upcoming",
  coverImageUrl: "/images/sydney_harbour_bridge.jpg",
  outboundFlight,
  returnFlight,
} as const;

function bindings(surface: Env["SURFACE"]): Env {
  return {
    ...env,
    SURFACE: surface,
    APP_ORIGIN: "http://localhost",
    PARTNER_ORIGIN: "http://localhost",
    DEV_AUTH: "enabled",
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

async function tripRequest(
  role: "owner" | "partner",
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return app.request(
    `http://localhost${path}`,
    {
      ...init,
      headers: new Headers(init.headers ?? headers(role)),
    },
    bindings(role === "owner" ? "admin" : "partner")
  );
}

async function createTrip(
  role: "owner" | "partner" = "owner",
  input: Record<string, unknown> = validTrip
): Promise<Trip> {
  const response = await tripRequest(role, "/api/trips", {
    method: "POST",
    headers: headers(role, true),
    body: JSON.stringify(input),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { trip: Trip }).trip;
}

describe("shared trip library API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM trips").run();
    await env.DB.prepare(
      "DELETE FROM members WHERE id NOT IN ('owner', 'partner')"
    ).run();
  });

  it.each(["owner", "partner"] as const)(
    "%s can create, trash, and restore a shared trip",
    async (role) => {
      const created = await createTrip(role);

      expect(created).toMatchObject({
        title: "시드니 여행",
        createdBy: role,
        updatedBy: role,
        version: 1,
        syncVersion: 0,
        journeyStartsAt: outboundFlight.scheduledDepartureAt,
        journeyEndsAt: returnFlight.scheduledArrivalAt,
        outboundFlight,
        returnFlight,
        representativeMediaId: null,
        deletedAt: null,
        purgeAfter: null,
      });
      await expect(
        env.DB.prepare(
          "SELECT member_id FROM trip_members WHERE trip_id = ? ORDER BY member_id"
        )
          .bind(created.id)
          .all<{ member_id: string }>()
      ).resolves.toMatchObject({
        results: [{ member_id: "owner" }, { member_id: "partner" }],
      });

      const trashed = await tripRequest(role, `/api/trips/${created.id}`, {
        method: "DELETE",
        headers: headers(role, true),
        body: JSON.stringify({ baseVersion: 1 }),
      });
      expect(trashed.status).toBe(204);

      const trashList = await tripRequest(role, "/api/trips?view=trash", {
        headers: headers(role),
      });
      expect(trashList.status).toBe(200);
      await expect(trashList.json()).resolves.toMatchObject({
        trips: [
          {
            id: created.id,
            version: 2,
            deletedAt: "2026-07-27T00:00:00.000Z",
            purgeAfter: "2026-08-26T00:00:00.000Z",
          },
        ],
      });

      const restored = await tripRequest(
        role,
        `/api/trips/${created.id}/restore`,
        {
          method: "POST",
          headers: headers(role, true),
          body: JSON.stringify({ baseVersion: 2 }),
        }
      );
      expect(restored.status).toBe(200);
      await expect(restored.json()).resolves.toMatchObject({
        trip: {
          id: created.id,
          version: 3,
          deletedAt: null,
          purgeAfter: null,
        },
      });
    }
  );

  it("lists only the requested view in deterministic updated order", async () => {
    const first = await createTrip("owner", {
      ...validTrip,
      title: "첫 여행",
    });
    const second = await createTrip("owner", {
      ...validTrip,
      title: "둘째 여행",
    });

    const active = await tripRequest("owner", "/api/trips", {
      headers: headers("owner"),
    });
    expect(active.status).toBe(200);
    const activeBody = (await active.json()) as { trips: Trip[] };
    expect(activeBody.trips.map((trip) => trip.id)).toEqual(
      [first.id, second.id].sort()
    );

    await tripRequest("owner", `/api/trips/${first.id}`, {
      method: "DELETE",
      headers: headers("owner", true),
      body: JSON.stringify({ baseVersion: 1 }),
    });

    const remaining = await tripRequest("owner", "/api/trips?view=active", {
      headers: headers("owner"),
    });
    await expect(remaining.json()).resolves.toMatchObject({
      trips: [{ id: second.id }],
    });
    const trash = await tripRequest("owner", "/api/trips?view=trash", {
      headers: headers("owner"),
    });
    await expect(trash.json()).resolves.toMatchObject({
      trips: [{ id: first.id }],
    });
  });

  it("returns measured library summary counts without inferring a country", async () => {
    const created = await createTrip();
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM trip_members WHERE trip_id = ? AND member_id = 'partner'"
      ).bind(created.id),
      env.DB.prepare(
        `INSERT INTO bookings (
          id, trip_id, place_id, booking_type, provider, starts_at, ends_at,
          reservation_code, payment_status, external_url, document_url, memo,
          is_fixed, version, updated_by, updated_at
        ) VALUES (?, ?, NULL, 'flight', ?, ?, NULL, NULL, 'paid',
          NULL, NULL, '', 1, 1, 'owner', ?)`
      ).bind(
        "booking-one",
        created.id,
        "Qantas",
        "2026-09-10T09:00:00.000Z",
        fixedNow.toISOString()
      ),
      env.DB.prepare(
        `INSERT INTO bookings (
          id, trip_id, place_id, booking_type, provider, starts_at, ends_at,
          reservation_code, payment_status, external_url, document_url, memo,
          is_fixed, version, updated_by, updated_at
        ) VALUES (?, ?, NULL, 'lodging', ?, ?, NULL, NULL, 'partial',
          NULL, NULL, '', 1, 1, 'owner', ?)`
      ).bind(
        "booking-two",
        created.id,
        "Meriton",
        "2026-09-10T14:00:00.000Z",
        fixedNow.toISOString()
      ),
      env.DB.prepare(
        `INSERT INTO trip_days
         (id, trip_id, day_date, title, position, version, updated_by, updated_at)
         VALUES ('summary-day', ?, '2026-09-10', 'DAY 01', 0, 1, 'owner', ?)`
      ).bind(created.id, fixedNow.toISOString()),
      env.DB.prepare(
        `INSERT INTO schedule_items (
          id, trip_id, trip_day_id, place_id, booking_id, title, starts_at,
          ends_at, memo, travel_mode, travel_note, position, is_fixed,
          is_done, version, updated_by, updated_at
        ) VALUES ('summary-item', ?, 'summary-day', NULL, NULL, '체크인',
          NULL, NULL, '', NULL, '', 0, 0, 0, 1, 'owner', ?)`
      ).bind(created.id, fixedNow.toISOString()),
    ]);

    const response = await tripRequest("owner", "/api/trips", {
      headers: headers("owner"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      trips: [
        {
          id: created.id,
          country: null,
          travelerCount: 1,
          bookingCount: 2,
          scheduleItemCount: 1,
        },
      ],
    });
  });

  it("adds every active participant to a new trip", async () => {
    await env.DB.prepare(
      `INSERT INTO members
       (id, role, display_name, access_email, created_at)
       VALUES ('extra-partner', 'partner', '추가 사용자', NULL, ?)`
    )
      .bind(fixedNow.toISOString())
      .run();

    const created = await createTrip();

    const { results } = await env.DB.prepare(
      "SELECT member_id FROM trip_members WHERE trip_id = ? ORDER BY member_id"
    )
      .bind(created.id)
      .all<{ member_id: string }>();
    expect(results).toEqual([
      { member_id: "extra-partner" },
      { member_id: "owner" },
      { member_id: "partner" },
    ]);
  });

  it("fully updates a trip and advances its version", async () => {
    const created = await createTrip();
    const response = await tripRequest("partner", `/api/trips/${created.id}`, {
      method: "PATCH",
      headers: headers("partner", true),
      body: JSON.stringify({
        ...validTrip,
        title: "함께 수정한 여행",
        status: "active",
        baseVersion: 1,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      trip: {
        id: created.id,
        title: "함께 수정한 여행",
        status: "active",
        version: 2,
        updatedBy: "partner",
        updatedAt: fixedNow.toISOString(),
      },
    });
  });

  it("clears journey boundaries when a flight is cancelled", async () => {
    const created = await createTrip();
    const response = await tripRequest("owner", `/api/trips/${created.id}`, {
      method: "PATCH",
      headers: headers("owner", true),
      body: JSON.stringify({
        ...validTrip,
        returnFlight: { ...returnFlight, status: "cancelled" },
        baseVersion: 1,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      trip: {
        journeyStartsAt: null,
        journeyEndsAt: null,
        returnFlight: { status: "cancelled" },
      },
    });
  });

  it("rejects stale writes with the current trip", async () => {
    const created = await createTrip();
    await tripRequest("owner", `/api/trips/${created.id}`, {
      method: "PATCH",
      headers: headers("owner", true),
      body: JSON.stringify({
        ...validTrip,
        title: "서버 최신 제목",
        baseVersion: 1,
      }),
    });

    const stale = await tripRequest("partner", `/api/trips/${created.id}`, {
      method: "DELETE",
      headers: headers("partner", true),
      body: JSON.stringify({ baseVersion: 1 }),
    });

    expect(stale.status).toBe(409);
    expect(stale.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(stale.json()).resolves.toMatchObject({
      error: {
        code: "VERSION_CONFLICT",
        details: {
          current: {
            id: created.id,
            title: "서버 최신 제목",
            version: 2,
          },
        },
      },
    });
  });

  it("marks authenticated trip lists as private and non-cacheable", async () => {
    const response = await tripRequest("owner", "/api/trips", {
      headers: headers("owner"),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("accepts an uppercase HTTPS cover image scheme", async () => {
    const response = await tripRequest("owner", "/api/trips", {
      method: "POST",
      headers: headers("owner", true),
      body: JSON.stringify({
        ...validTrip,
        coverImageUrl: "HTTPS://example.com/cover.jpg",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      trip: { coverImageUrl: "HTTPS://example.com/cover.jpg" },
    });
  });

  it("does not reveal or mutate a trip without membership", async () => {
    const created = await createTrip();
    await env.DB.prepare(
      "DELETE FROM trip_members WHERE trip_id = ? AND member_id = 'partner'"
    )
      .bind(created.id)
      .run();

    const list = await tripRequest("partner", "/api/trips", {
      headers: headers("partner"),
    });
    await expect(list.json()).resolves.toEqual({ trips: [] });

    const update = await tripRequest("partner", `/api/trips/${created.id}`, {
      method: "PATCH",
      headers: headers("partner", true),
      body: JSON.stringify({
        ...validTrip,
        title: "권한 없는 수정",
        baseVersion: 1,
      }),
    });
    expect(update.status).toBe(404);
    await expect(update.json()).resolves.toMatchObject({
      error: { code: "TRIP_NOT_FOUND" },
    });
  });

  it.each([
    ["empty title", { title: "   " }],
    ["backwards dates", { startDate: "2026-09-15", endDate: "2026-09-14" }],
    ["invalid timezone", { timeZone: "Australia/Nowhere" }],
    ["insecure cover URL", { coverImageUrl: "http://example.com/cover.jpg" }],
    ["invalid airport code", {
      outboundFlight: { ...outboundFlight, departureIataCode: "IC" },
    }],
    ["local flight time", {
      outboundFlight: {
        ...outboundFlight,
        scheduledDepartureAt: "2026-09-09T22:00:00",
      },
    }],
    ["reversed journey boundaries", {
      returnFlight: {
        ...returnFlight,
        scheduledArrivalAt: "2026-09-08T20:00:00+09:00",
        estimatedArrivalAt: null,
      },
    }],
    ["invalid base version", { baseVersion: 0 }],
  ])("rejects %s", async (_name, invalid) => {
    const input = { ...validTrip, ...invalid };
    const response =
      "baseVersion" in invalid
        ? await tripRequest("owner", "/api/trips/not-a-trip", {
            method: "PATCH",
            headers: headers("owner", true),
            body: JSON.stringify(input),
          })
        : await tripRequest("owner", "/api/trips", {
            method: "POST",
            headers: headers("owner", true),
            body: JSON.stringify(input),
          });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TRIP_INPUT_INVALID" },
    });
  });

  it("rejects malformed JSON and unsupported views", async () => {
    const malformed = await tripRequest("owner", "/api/trips", {
      method: "POST",
      headers: headers("owner", true),
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const view = await tripRequest("owner", "/api/trips?view=everything", {
      headers: headers("owner"),
    });
    expect(view.status).toBe(400);
    await expect(view.json()).resolves.toMatchObject({
      error: { code: "TRIP_VIEW_INVALID" },
    });
  });

  it("keeps the shared origin guard on trip writes", async () => {
    const response = await app.request(
      "http://localhost/api/trips",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example",
          "X-Dev-Principal": "owner",
        },
        body: JSON.stringify(validTrip),
      },
      bindings("admin")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_REJECTED" },
    });
  });

  it("refuses restore at the exact purge deadline", async () => {
    const created = await createTrip();
    await env.DB.prepare(
      `UPDATE trips
       SET deleted_at = '2026-06-27T00:00:00.000Z',
           purge_after = '2026-07-27T00:00:00.000Z',
           version = 2
       WHERE id = ?`
    )
      .bind(created.id)
      .run();

    const response = await tripRequest(
      "owner",
      `/api/trips/${created.id}/restore`,
      {
        method: "POST",
        headers: headers("owner", true),
        body: JSON.stringify({ baseVersion: 2 }),
      }
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TRIP_PURGE_EXPIRED" },
    });
  });

  it("scheduled purge deletes only expired trash and cascades children", async () => {
    const past = await createTrip("owner", { ...validTrip, title: "지난 휴지통" });
    const boundary = await createTrip("owner", {
      ...validTrip,
      title: "경계 휴지통",
    });
    const future = await createTrip("owner", {
      ...validTrip,
      title: "복구 가능",
    });
    const active = await createTrip("owner", {
      ...validTrip,
      title: "활성 여행",
    });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE trips SET deleted_at = ?, purge_after = ? WHERE id = ?"
      ).bind(
        "2026-06-26T23:59:59.000Z",
        "2026-07-26T23:59:59.000Z",
        past.id
      ),
      env.DB.prepare(
        "UPDATE trips SET deleted_at = ?, purge_after = ? WHERE id = ?"
      ).bind(
        "2026-06-27T00:00:00.000Z",
        "2026-07-27T00:00:00.000Z",
        boundary.id
      ),
      env.DB.prepare(
        "UPDATE trips SET deleted_at = ?, purge_after = ? WHERE id = ?"
      ).bind(
        "2026-06-28T00:00:00.000Z",
        "2026-07-28T00:00:00.000Z",
        future.id
      ),
      env.DB.prepare("UPDATE trips SET purge_after = ? WHERE id = ?").bind(
        "2026-07-26T00:00:00.000Z",
        active.id
      ),
      env.DB.prepare(
        `INSERT INTO trip_days
         (id, trip_id, day_date, title, position, version, updated_by, updated_at)
         VALUES ('purge-day', ?, '2026-09-10', 'DAY 01', 0, 1, 'owner', ?)`
      ).bind(boundary.id, fixedNow.toISOString()),
    ]);

    const scheduled = (
      worker as unknown as {
        scheduled?: (
          event: ScheduledController,
          bindings: Env,
          context: ExecutionContext
        ) => void;
      }
    ).scheduled;
    expect(typeof scheduled).toBe("function");
    const context = createExecutionContext();
    scheduled!(
      createScheduledController({ scheduledTime: fixedNow.getTime() }),
      bindings("admin"),
      context
    );
    await waitOnExecutionContext(context);

    const { results } = await env.DB.prepare(
      "SELECT id FROM trips ORDER BY id"
    ).all<{ id: string }>();
    expect(results.map((row) => row.id).sort()).toEqual(
      [active.id, future.id].sort()
    );
    await expect(
      env.DB.prepare("SELECT id FROM trip_days WHERE id = 'purge-day'").first()
    ).resolves.toBeNull();
    await expect(
      env.DB.prepare(
        "SELECT member_id FROM trip_members WHERE trip_id = ?"
      )
        .bind(boundary.id)
        .all()
    ).resolves.toMatchObject({ results: [] });
  });
});
