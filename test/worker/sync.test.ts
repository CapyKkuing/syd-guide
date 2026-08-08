import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import { runSettlementGroupBatch } from "../../worker/db/mutation-store";
import type { Env } from "../../worker/env";
import type { Trip } from "../../src/shared/entities";
import type {
  SettlementGroupCreateRequest,
  SettlementTransferCompleteRequest,
} from "../../src/shared/mutations";

const fixedNow = new Date("2026-07-27T00:00:00.000Z");
const app = createApp({ now: () => fixedNow });

function bindings(role: "owner" | "partner"): Env {
  return {
    ...env,
    SURFACE: role === "owner" ? "admin" : "partner",
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

async function request(
  role: "owner" | "partner",
  path: string,
  init: RequestInit = {},
  customBindings: Env = bindings(role)
) {
  return app.request(
    `http://localhost${path}`,
    { ...init, headers: new Headers(init.headers ?? headers(role)) },
    customBindings
  );
}

async function seedTrip(): Promise<Trip> {
  const response = await request("owner", "/api/trips", {
    method: "POST",
    headers: headers("owner", true),
    body: JSON.stringify({
      title: "시드니 여행",
      destination: "Sydney, Australia",
      startDate: "2026-09-10",
      endDate: "2026-09-14",
      timeZone: "Australia/Sydney",
      status: "upcoming",
      coverImageUrl: "/images/sydney_harbour_bridge.jpg",
    }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { trip: Trip }).trip;
}

function placeCreate(
  idempotencyKey: string,
  entityId = "place-one"
) {
  return {
    idempotencyKey,
    entity: "place",
    action: "create",
    entityId,
    baseVersion: null,
    payload: {
      name: "Opera House",
      category: "attraction",
      status: "saved",
      address: "Bennelong Point",
      latitude: -33.8568,
      longitude: 151.2153,
      mapUrl: "https://maps.example/opera",
      sourceUrl: "https://example.com/opera",
      imageUrl: "/images/opera.jpg",
      description: "Harbour landmark",
      savedBy: "owner",
    },
  };
}

function settlementGroupCreate(
  idempotencyKey = "settlement-group-key",
  transferIds = ["settlement-one", "settlement-two"],
  entityId = "settlement-group-one"
): SettlementGroupCreateRequest {
  return {
    idempotencyKey,
    entity: "settlement_transfer",
    action: "create_group",
    entityId,
    baseVersion: null,
    payload: {
      expenseIds: ["expense-shared"],
      currency: "AUD",
      transfers: [
        {
          entityId: transferIds[0] ?? "settlement-one",
          fromMemberId: "partner",
          toMemberId: "owner",
          amountMinor: 10_000,
        },
        {
          entityId: transferIds[1] ?? "settlement-two",
          fromMemberId: "friend",
          toMemberId: "owner",
          amountMinor: 10_000,
        },
      ],
    },
  };
}

function settlementComplete(
  entityId: string,
  idempotencyKey: string
): SettlementTransferCompleteRequest {
  return {
    idempotencyKey,
    entity: "settlement_transfer",
    action: "complete",
    entityId,
    baseVersion: 1,
    payload: { settlementGroupId: "settlement-group-one" },
  };
}

async function seedThreePersonExpense(tripId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO members (
        id, role, display_name, access_email, created_at
      ) VALUES ('friend', 'partner', '친구', NULL, ?)`
    ).bind(fixedNow.toISOString()),
    env.DB.prepare(
      `INSERT OR IGNORE INTO trip_members (trip_id, member_id, joined_at)
       VALUES (?, 'friend', ?)`
    ).bind(tripId, fixedNow.toISOString()),
  ]);
  const response = await postMutation(tripId, {
    idempotencyKey: "expense-shared-key",
    entity: "expense",
    action: "create",
    entityId: "expense-shared",
    baseVersion: null,
    payload: {
      phase: "travel",
      category: "food",
      customCategory: null,
      title: "함께 먹은 저녁",
      amountMinor: 30_000,
      currency: "AUD",
      spentOn: "2026-09-10",
      paidByMemberId: "owner",
      expenseScope: "shared",
      personalForMemberId: null,
      paymentMethod: "card",
      isSettled: false,
      memo: "",
    },
  });
  expect(response.status).toBe(200);
}

async function postMutation(
  tripId: string,
  body: unknown,
  role: "owner" | "partner" = "owner"
) {
  return request(role, `/api/trips/${tripId}/mutations`, {
    method: "POST",
    headers: headers(role, true),
    body: JSON.stringify(body),
  });
}

function interleavingSnapshotDb(onInterleave: () => Promise<void>): {
  database: D1Database;
  stats: { batchCalls: number; independentTripReads: number };
} {
  const backing = new WeakMap<object, D1PreparedStatement>();
  const stats = { batchCalls: 0, independentTripReads: 0 };
  let interleaved = false;

  function wrap(
    initial: D1PreparedStatement,
    query: string
  ): D1PreparedStatement {
    let current = initial;
    const wrapper = {
      bind(...values: unknown[]) {
        current = current.bind(...values);
        backing.set(wrapper, current);
        return wrapper;
      },
      async first(columnName?: string) {
        const result = columnName
          ? await current.first(columnName)
          : await current.first();
        if (query.includes("SELECT t.* FROM trips t")) {
          stats.independentTripReads += 1;
          if (!interleaved) {
            interleaved = true;
            await onInterleave();
          }
        }
        return result;
      },
      run: () => current.run(),
      all: () => current.all(),
      raw: (options?: { columnNames?: boolean }) => options?.columnNames
        ? current.raw({ columnNames: true })
        : current.raw(),
    };
    backing.set(wrapper, current);
    return wrapper as unknown as D1PreparedStatement;
  }

  const database = {
    prepare(query: string) {
      return wrap(env.DB.prepare(query), query);
    },
    async batch<T>(statements: D1PreparedStatement[]) {
      stats.batchCalls += 1;
      if (!interleaved) {
        interleaved = true;
        await onInterleave();
      }
      return env.DB.batch<T>(
        statements.map((statement) => backing.get(statement) ?? statement)
      );
    },
  } as unknown as D1Database;
  return { database, stats };
}

describe("versioned trip sync API", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM trips").run();
    await env.DB.prepare("DELETE FROM members WHERE id = 'friend'").run();
  });

  it("returns the first result for a repeated idempotency key", async () => {
    const trip = await seedTrip();
    const mutation = placeCreate("same-key");

    const firstResponse = await postMutation(trip.id, mutation);
    const secondResponse = await postMutation(trip.id, mutation);
    const first = await firstResponse.json();
    const second = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(second).toEqual(first);
    expect(first).toEqual({
      entity: "place",
      entityId: "place-one",
      version: 1,
      syncVersion: 1,
    });
    await expect(
      env.DB.prepare("SELECT COUNT(*) AS count FROM places")
        .first<{ count: number }>()
    ).resolves.toEqual({ count: 1 });
    await expect(
      env.DB.prepare("SELECT COUNT(*) AS count FROM mutation_receipts")
        .first<{ count: number }>()
    ).resolves.toEqual({ count: 1 });
    await expect(
      env.DB.prepare("SELECT COUNT(*) AS count FROM activity_logs")
        .first<{ count: number }>()
    ).resolves.toEqual({ count: 1 });
    await expect(
      env.DB.prepare(
        "SELECT sync_version FROM trips WHERE id = ?"
      ).bind(trip.id).first<{ sync_version: number }>()
    ).resolves.toEqual({ sync_version: 1 });
  });

  it("creates a three-person settlement group once with one sync increment and receipt", async () => {
    const trip = await seedTrip();
    await seedThreePersonExpense(trip.id);
    const mutation = settlementGroupCreate();

    const firstResponse = await postMutation(trip.id, mutation);
    const secondResponse = await postMutation(trip.id, mutation);
    const first = await firstResponse.json();
    const second = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(second).toEqual(first);
    expect(first).toEqual({
      entity: "settlement_transfer",
      entityId: "settlement-group-one",
      version: 1,
      syncVersion: 2,
      transfers: [
        { entityId: "settlement-one", version: 1 },
        { entityId: "settlement-two", version: 1 },
      ],
    });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM settlement_transfers WHERE trip_id = ?"
    ).bind(trip.id).first()).resolves.toEqual({ count: 2 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM mutation_receipts WHERE idempotency_key = ?"
    ).bind(mutation.idempotencyKey).first()).resolves.toEqual({ count: 1 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM activity_logs WHERE entity_id = ?"
    ).bind(mutation.entityId).first()).resolves.toEqual({ count: 1 });
  });

  it("allows only one active settlement group for concurrent different requests", async () => {
    const trip = await seedTrip();
    await seedThreePersonExpense(trip.id);
    const first = settlementGroupCreate();
    const second = settlementGroupCreate(
      "settlement-group-other-key",
      ["settlement-other-one", "settlement-other-two"],
      "settlement-group-other"
    );

    const responses = await Promise.all([
      postMutation(trip.id, first),
      postMutation(trip.id, second),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM settlement_transfers WHERE trip_id = ?"
    ).bind(trip.id).first()).resolves.toEqual({ count: 2 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM settlement_expense_claims WHERE trip_id = ?"
    ).bind(trip.id).first()).resolves.toEqual({ count: 1 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM mutation_receipts WHERE trip_id = ? AND result_json LIKE '%settlement_transfer%'"
    ).bind(trip.id).first()).resolves.toEqual({ count: 1 });
  });

  it("rolls back every settlement transfer when one insert in the D1 batch fails", async () => {
    const trip = await seedTrip();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO members (
        id, role, display_name, access_email, created_at
      ) VALUES ('friend', 'partner', '친구', NULL, ?)`
    ).bind(fixedNow.toISOString()).run();
    const mutation = settlementGroupCreate(
      "settlement-rollback-key",
      ["duplicated-transfer", "duplicated-transfer"]
    );

    await expect(runSettlementGroupBatch(
      bindings("owner"),
      trip.id,
      { memberId: "owner", role: "owner" },
      mutation,
      fixedNow.toISOString()
    )).rejects.toThrow();

    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM settlement_transfers WHERE trip_id = ?"
    ).bind(trip.id).first()).resolves.toEqual({ count: 0 });
    await expect(env.DB.prepare(
      "SELECT sync_version FROM trips WHERE id = ?"
    ).bind(trip.id).first()).resolves.toEqual({ sync_version: 0 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM mutation_receipts WHERE idempotency_key = ?"
    ).bind(mutation.idempotencyKey).first()).resolves.toEqual({ count: 0 });
  });

  it("settles source expenses only when the last transfer completes", async () => {
    const trip = await seedTrip();
    await seedThreePersonExpense(trip.id);
    await postMutation(trip.id, settlementGroupCreate());

    const first = await postMutation(
      trip.id,
      settlementComplete("settlement-one", "complete-one-key")
    );
    expect(first.status).toBe(200);
    await expect(env.DB.prepare(
      "SELECT is_settled, version FROM expenses WHERE id = 'expense-shared'"
    ).first()).resolves.toEqual({ is_settled: 0, version: 1 });

    const secondRequest = settlementComplete(
      "settlement-two",
      "complete-two-key"
    );
    const second = await postMutation(trip.id, secondRequest);
    const repeated = await postMutation(trip.id, secondRequest);
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(repeated.status).toBe(200);
    await expect(repeated.json()).resolves.toEqual(secondBody);
    await expect(env.DB.prepare(
      "SELECT is_settled, version FROM expenses WHERE id = 'expense-shared'"
    ).first()).resolves.toEqual({ is_settled: 1, version: 2 });
    await expect(env.DB.prepare(
      `SELECT id, status, version FROM settlement_transfers
       WHERE trip_id = ? ORDER BY id`
    ).bind(trip.id).all()).resolves.toMatchObject({
      results: [
        { id: "settlement-one", status: "completed", version: 2 },
        { id: "settlement-two", status: "completed", version: 2 },
      ],
    });
    await expect(env.DB.prepare(
      "SELECT sync_version FROM trips WHERE id = ?"
    ).bind(trip.id).first()).resolves.toEqual({ sync_version: 4 });
  });

  it("collapses concurrent transfer completion with the same idempotency key", async () => {
    const trip = await seedTrip();
    await seedThreePersonExpense(trip.id);
    await postMutation(trip.id, settlementGroupCreate());
    const mutation = settlementComplete("settlement-one", "complete-concurrent-key");

    const responses = await Promise.all([
      postMutation(trip.id, mutation),
      postMutation(trip.id, mutation),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(bodies[1]).toEqual(bodies[0]);
    await expect(env.DB.prepare(
      "SELECT status, version FROM settlement_transfers WHERE id = 'settlement-one'"
    ).first()).resolves.toEqual({ status: "completed", version: 2 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM mutation_receipts WHERE idempotency_key = 'complete-concurrent-key'"
    ).first()).resolves.toEqual({ count: 1 });
  });

  it("rolls back the last transfer completion when expense settlement fails", async () => {
    const trip = await seedTrip();
    await seedThreePersonExpense(trip.id);
    await postMutation(trip.id, settlementGroupCreate());
    await postMutation(
      trip.id,
      settlementComplete("settlement-one", "complete-first-key")
    );
    await env.DB.prepare(
      `CREATE TRIGGER fail_expense_settlement
       BEFORE UPDATE OF is_settled ON expenses
       WHEN NEW.is_settled = 1
       BEGIN SELECT RAISE(ABORT, 'forced expense failure'); END`
    ).run();

    try {
      const response = await postMutation(
        trip.id,
        settlementComplete("settlement-two", "complete-rollback-key")
      );
      expect(response.status).toBe(500);
    } finally {
      await env.DB.prepare("DROP TRIGGER fail_expense_settlement").run();
    }

    await expect(env.DB.prepare(
      "SELECT status, version FROM settlement_transfers WHERE id = 'settlement-two'"
    ).first()).resolves.toEqual({ status: "pending", version: 1 });
    await expect(env.DB.prepare(
      "SELECT is_settled, version FROM expenses WHERE id = 'expense-shared'"
    ).first()).resolves.toEqual({ is_settled: 0, version: 1 });
    await expect(env.DB.prepare(
      "SELECT sync_version FROM trips WHERE id = ?"
    ).bind(trip.id).first()).resolves.toEqual({ sync_version: 3 });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM mutation_receipts WHERE idempotency_key = 'complete-rollback-key'"
    ).first()).resolves.toEqual({ count: 0 });

    const retried = await postMutation(
      trip.id,
      settlementComplete("settlement-two", "complete-rollback-key")
    );
    expect(retried.status).toBe(200);
    await expect(env.DB.prepare(
      "SELECT status, version FROM settlement_transfers WHERE id = 'settlement-two'"
    ).first()).resolves.toEqual({ status: "completed", version: 2 });
  });

  it("collapses concurrent duplicate requests into one atomic mutation", async () => {
    const trip = await seedTrip();
    const mutation = placeCreate("concurrent-key", "place-concurrent");

    const [firstResponse, secondResponse] = await Promise.all([
      postMutation(trip.id, mutation),
      postMutation(trip.id, mutation),
    ]);
    const [first, second] = await Promise.all([
      firstResponse.json(),
      secondResponse.json(),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(second).toEqual(first);
    await expect(
      env.DB.prepare(
        `SELECT
          (SELECT COUNT(*) FROM places) AS entities,
          (SELECT COUNT(*) FROM activity_logs) AS activities,
          (SELECT COUNT(*) FROM mutation_receipts) AS receipts,
          (SELECT sync_version FROM trips WHERE id = ?) AS sync_version`
      ).bind(trip.id).first()
    ).resolves.toEqual({
      entities: 1,
      activities: 1,
      receipts: 1,
      sync_version: 1,
    });
  });

  it("returns current entity on stale base version", async () => {
    const trip = await seedTrip();
    await env.DB.prepare(
      `INSERT INTO places (
        id, trip_id, name, category, status, address, latitude, longitude,
        map_url, source_url, image_url, description, saved_by, version,
        updated_by, updated_at
      ) VALUES ('place-current', ?, 'Current', 'cafe', 'saved', NULL, NULL,
        NULL, NULL, NULL, NULL, '', 'owner', 3, 'owner', ?)`
    ).bind(trip.id, fixedNow.toISOString()).run();

    const response = await postMutation(trip.id, {
      ...placeCreate("stale-key", "place-current"),
      action: "update",
      baseVersion: 2,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "VERSION_CONFLICT",
        details: {
          current: { id: "place-current", name: "Current", version: 3 },
        },
      },
    });
    await expect(
      env.DB.prepare(
        "SELECT sync_version FROM trips WHERE id = ?"
      ).bind(trip.id).first<{ sync_version: number }>()
    ).resolves.toEqual({ sync_version: 0 });
  });

  it("returns an ETag snapshot and 304 without a response body", async () => {
    const trip = await seedTrip();
    const first = await request("owner", `/api/trips/${trip.id}/snapshot`, {
      headers: headers("owner"),
    });

    expect(first.status).toBe(200);
    expect(first.headers.get("ETag")).toBe(`"trip-${trip.id}-0"`);
    expect(first.headers.get("Cache-Control")).toBe(
      "private, must-revalidate"
    );
    await expect(first.json()).resolves.toMatchObject({
      trip: { id: trip.id },
      members: [
        { id: "owner", role: "owner", displayName: "나" },
        { id: "partner", role: "partner", displayName: "여자친구" },
      ],
      syncVersion: 0,
    });

    const cachedHeaders = headers("owner");
    cachedHeaders.set("If-None-Match", `"trip-${trip.id}-0"`);
    const cached = await request(
      "owner",
      `/api/trips/${trip.id}/snapshot`,
      { headers: cachedHeaders }
    );
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
    expect(cached.headers.get("Cache-Control")).toBe(
      "private, must-revalidate"
    );
  });

  it("reads snapshot rows and their ETag version in one D1 transaction", async () => {
    const trip = await seedTrip();
    const { database, stats } = interleavingSnapshotDb(async () => {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO places (
            id, trip_id, name, category, status, address, latitude, longitude,
            map_url, source_url, image_url, description, saved_by, version,
            updated_by, updated_at
          ) VALUES (
            'place-interleaved', ?, 'Interleaved', 'cafe', 'saved', NULL,
            NULL, NULL, NULL, NULL, NULL, '', 'owner', 1, 'owner', ?
          )`
        ).bind(trip.id, fixedNow.toISOString()),
        env.DB.prepare(
          "UPDATE trips SET sync_version = sync_version + 1 WHERE id = ?"
        ).bind(trip.id),
      ]);
    });

    const response = await request(
      "owner",
      `/api/trips/${trip.id}/snapshot`,
      { headers: headers("owner") },
      { ...bindings("owner"), DB: database }
    );
    const body = await response.json() as {
      places: Array<{ id: string }>;
      syncVersion: number;
    };

    expect(response.status).toBe(200);
    expect(stats.batchCalls).toBe(1);
    expect(stats.independentTripReads).toBe(0);
    expect(body.syncVersion).toBe(1);
    expect(body.places.map(({ id }) => id)).toContain("place-interleaved");
    expect(response.headers.get("ETag")).toBe(`"trip-${trip.id}-1"`);
  });

  it("does not disclose a trip to an authenticated non-member", async () => {
    const trip = await seedTrip();
    await env.DB.prepare(
      "DELETE FROM trip_members WHERE trip_id = ? AND member_id = 'partner'"
    ).bind(trip.id).run();

    const hidden = await request(
      "partner",
      `/api/trips/${trip.id}/snapshot`,
      { headers: headers("partner") }
    );
    const missing = await request(
      "partner",
      "/api/trips/not-a-trip/snapshot",
      { headers: headers("partner") }
    );

    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await hidden.json()).toEqual(await missing.json());
  });

  it("keeps each member's personal checks and notes private", async () => {
    const trip = await seedTrip();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO check_items (
          id, trip_id, scope, owner_member_id, assignee_member_id, title,
          quantity, memo, is_done, position, version, updated_by, updated_at
        ) VALUES
          ('check-shared', ?, 'shared', NULL, NULL, 'Shared', 1, '', 0, 0, 1, 'owner', ?),
          ('check-owner', ?, 'personal', 'owner', NULL, 'Owner secret', 1, '', 0, 1, 1, 'owner', ?),
          ('check-partner', ?, 'personal', 'partner', NULL, 'Partner secret', 1, '', 0, 2, 1, 'partner', ?)`
      ).bind(
        trip.id, fixedNow.toISOString(),
        trip.id, fixedNow.toISOString(),
        trip.id, fixedNow.toISOString()
      ),
      env.DB.prepare(
        `INSERT INTO notes (
          id, trip_id, target_type, target_id, visibility, author_member_id,
          body, attachment_url, version, updated_by, updated_at
        ) VALUES
          ('note-shared', ?, 'trip', NULL, 'shared', 'owner', 'Shared note', NULL, 1, 'owner', ?),
          ('note-owner', ?, 'trip', NULL, 'personal', 'owner', 'Owner note', NULL, 1, 'owner', ?),
          ('note-partner', ?, 'trip', NULL, 'personal', 'partner', 'Partner note', NULL, 1, 'partner', ?)`
      ).bind(
        trip.id, fixedNow.toISOString(),
        trip.id, fixedNow.toISOString(),
        trip.id, fixedNow.toISOString()
      ),
    ]);

    const owner = await request("owner", `/api/trips/${trip.id}/snapshot`, {
      headers: headers("owner"),
    });
    const partner = await request(
      "partner",
      `/api/trips/${trip.id}/snapshot`,
      { headers: headers("partner") }
    );
    const ownerBody = await owner.json() as {
      checkItems: Array<{ id: string }>;
      notes: Array<{ id: string }>;
    };
    const partnerBody = await partner.json() as typeof ownerBody;

    expect(ownerBody.checkItems.map(({ id }) => id).filter((id) => id.startsWith("check-"))).toEqual([
      "check-shared",
      "check-owner",
    ]);
    expect(ownerBody.notes.map(({ id }) => id)).toEqual([
      "note-shared",
      "note-owner",
    ]);
    expect(partnerBody.checkItems.map(({ id }) => id).filter((id) => id.startsWith("check-"))).toEqual([
      "check-shared",
      "check-partner",
    ]);
    expect(partnerBody.notes.map(({ id }) => id)).toEqual([
      "note-shared",
      "note-partner",
    ]);
  });

  it("overrides client ownership for personal check and note mutations", async () => {
    const trip = await seedTrip();
    const check = await postMutation(trip.id, {
      idempotencyKey: "partner-check",
      entity: "check_item",
      action: "create",
      entityId: "private-check",
      baseVersion: null,
      payload: {
        scope: "personal",
        ownerMemberId: "owner",
        assigneeMemberId: null,
        title: "Private item",
        quantity: 1,
        memo: "",
        requirementKind: null,
        isDone: false,
        position: 0,
      },
    }, "partner");
    const note = await postMutation(trip.id, {
      idempotencyKey: "partner-note",
      entity: "note",
      action: "create",
      entityId: "private-note",
      baseVersion: null,
      payload: {
        targetType: "trip",
        targetId: null,
        visibility: "personal",
        body: "Only partner",
        attachmentUrl: null,
      },
    }, "partner");

    expect(check.status).toBe(200);
    expect(note.status).toBe(200);
    await expect(
      env.DB.prepare(
        "SELECT owner_member_id FROM check_items WHERE id = 'private-check'"
      ).first<{ owner_member_id: string }>()
    ).resolves.toEqual({ owner_member_id: "partner" });
    await expect(
      env.DB.prepare(
        "SELECT author_member_id FROM notes WHERE id = 'private-note'"
      ).first<{ author_member_id: string }>()
    ).resolves.toEqual({ author_member_id: "partner" });
  });

  it("does not reveal or mutate another member's personal entity", async () => {
    const trip = await seedTrip();
    const created = await postMutation(trip.id, {
      idempotencyKey: "owner-private-note",
      entity: "note",
      action: "create",
      entityId: "owner-note",
      baseVersion: null,
      payload: {
        targetType: "trip",
        targetId: null,
        visibility: "personal",
        body: "Owner secret body",
        attachmentUrl: null,
      },
    });
    expect(created.status).toBe(200);

    const response = await postMutation(trip.id, {
      idempotencyKey: "partner-private-update",
      entity: "note",
      action: "update",
      entityId: "owner-note",
      baseVersion: 1,
      payload: {
        targetType: "trip",
        targetId: null,
        visibility: "personal",
        body: "Partner overwrite",
        attachmentUrl: null,
      },
    }, "partner");
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(409);
    expect(serialized).toContain('"current":null');
    expect(serialized).not.toContain("Owner secret body");
    await expect(
      env.DB.prepare(
        "SELECT body, version FROM notes WHERE id = 'owner-note'"
      ).first()
    ).resolves.toEqual({ body: "Owner secret body", version: 1 });
  });

  it("allows either trip member to update shared entities", async () => {
    const trip = await seedTrip();
    expect(
      (await postMutation(trip.id, placeCreate("owner-shared-create"))).status
    ).toBe(200);

    const response = await postMutation(trip.id, {
      ...placeCreate("partner-shared-update"),
      action: "update",
      baseVersion: 1,
      payload: {
        ...placeCreate("ignored").payload,
        name: "Partner updated",
      },
    }, "partner");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      version: 2,
      syncVersion: 2,
    });
    await expect(
      env.DB.prepare(
        "SELECT name, updated_by FROM places WHERE id = 'place-one'"
      ).first()
    ).resolves.toEqual({ name: "Partner updated", updated_by: "partner" });
  });

  it("applies create update and physical delete with monotonic versions", async () => {
    const trip = await seedTrip();
    const created = await postMutation(trip.id, placeCreate("create-version"));
    const updated = await postMutation(trip.id, {
      ...placeCreate("update-version"),
      action: "update",
      baseVersion: 1,
      payload: {
        ...placeCreate("ignored").payload,
        name: "Updated place",
      },
    });
    const deleted = await postMutation(trip.id, {
      idempotencyKey: "delete-version",
      entity: "place",
      action: "delete",
      entityId: "place-one",
      baseVersion: 2,
      payload: null,
    });

    expect(await created.json()).toEqual({
      entity: "place",
      entityId: "place-one",
      version: 1,
      syncVersion: 1,
    });
    expect(await updated.json()).toEqual({
      entity: "place",
      entityId: "place-one",
      version: 2,
      syncVersion: 2,
    });
    expect(await deleted.json()).toEqual({
      entity: "place",
      entityId: "place-one",
      version: 3,
      syncVersion: 3,
    });
    expect(
      await env.DB.prepare("SELECT id FROM places WHERE id = 'place-one'")
        .first()
    ).toBeNull();
  });

  it("supports validated creates for every mutable entity", async () => {
    const trip = await seedTrip();
    const mutations = [
      {
        idempotencyKey: "day-create",
        entity: "trip_day",
        action: "create",
        entityId: "day-one",
        baseVersion: null,
        payload: { dayDate: "2026-09-10", title: "DAY 01", position: 0 },
      },
      placeCreate("place-create", "place-dependency"),
      {
        idempotencyKey: "booking-create",
        entity: "booking",
        action: "create",
        entityId: "booking-one",
        baseVersion: null,
        payload: {
          placeId: "place-dependency",
          bookingType: "ticket",
          provider: "Sydney Opera House",
          startsAt: "2026-09-10T10:00:00+10:00",
          endsAt: null,
          reservationCode: "RES-SECRET",
          paymentStatus: "paid",
          externalUrl: "https://example.com/booking",
          documentUrl: "https://example.com/document",
          documentFile: {
            provider: "google-drive",
            providerObjectId: "voucher-object-123",
            originalName: "opera-ticket.pdf",
            mimeType: "application/pdf",
          },
          memo: "private booking memo",
          isFixed: true,
          isRequired: true,
        },
      },
      {
        idempotencyKey: "schedule-create",
        entity: "schedule_item",
        action: "create",
        entityId: "schedule-one",
        baseVersion: null,
        payload: {
          tripDayId: "day-one",
          placeId: "place-dependency",
          bookingId: "booking-one",
          title: "Opera visit",
          startsAt: "2026-09-10T10:00:00+10:00",
          endsAt: "2026-09-10T11:00:00+10:00",
          memo: "",
          travelMode: "walk",
          travelNote: "",
          position: 0,
          isFixed: true,
          isDone: false,
        },
      },
      {
        idempotencyKey: "check-create",
        entity: "check_item",
        action: "create",
        entityId: "check-one",
        baseVersion: null,
        payload: {
          scope: "shared",
          ownerMemberId: null,
          assigneeMemberId: "partner",
          title: "Passport",
          quantity: 2,
          memo: "",
          requirementKind: "passport",
          isDone: false,
          position: 0,
        },
      },
      {
        idempotencyKey: "expense-create",
        entity: "expense",
        action: "create",
        entityId: "expense-one",
        baseVersion: null,
        payload: {
          phase: "pretrip",
          category: "flight",
          title: "Flights",
          amountMinor: 1_200_000,
          currency: "KRW",
          spentOn: "2026-09-01",
          paidByMemberId: "owner",
          expenseScope: "shared",
          personalForMemberId: null,
          paymentMethod: "card",
          isSettled: false,
          memo: "",
        },
      },
      {
        idempotencyKey: "note-create",
        entity: "note",
        action: "create",
        entityId: "note-one",
        baseVersion: null,
        payload: {
          targetType: "place",
          targetId: "place-dependency",
          visibility: "shared",
          body: "Meet here",
          attachmentUrl: "https://example.com/note",
        },
      },
      {
        idempotencyKey: "vote-create",
        entity: "vote",
        action: "create",
        entityId: "vote-one",
        baseVersion: null,
        payload: {
          targetType: "place",
          targetId: "place-dependency",
          choice: "must",
        },
      },
    ];

    for (const mutation of mutations) {
      const response = await postMutation(trip.id, mutation);
      expect(response.status).toBe(200);
    }

    const snapshot = await request(
      "owner",
      `/api/trips/${trip.id}/snapshot`,
      { headers: headers("owner") }
    );
    const snapshotBody = await snapshot.json() as {
      checkItems: Array<{ id: string; version: number }>;
      [key: string]: unknown;
    };
    expect(snapshotBody).toMatchObject({
      days: [{ id: "day-one", version: 1 }],
      scheduleItems: [{ id: "schedule-one", version: 1 }],
      places: [{ id: "place-dependency", version: 1 }],
      bookings: [{
        id: "booking-one",
        version: 1,
        documentFile: {
          provider: "google-drive",
          providerObjectId: "voucher-object-123",
          originalName: "opera-ticket.pdf",
          mimeType: "application/pdf",
        },
      }],
      expenses: [{ id: "expense-one", version: 1 }],
      notes: [{ id: "note-one", version: 1 }],
      votes: [{ id: "vote-one", version: 1 }],
      syncVersion: 8,
    });
    expect(snapshotBody.checkItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "check-one", version: 1 }),
    ]));
  });

  it("rejects malformed IDs, unsafe URLs, coordinates, and action shapes", async () => {
    const trip = await seedTrip();
    const cases = [
      { ...placeCreate("bad key"), idempotencyKey: "bad key" },
      {
        ...placeCreate("unsafe-url"),
        payload: { ...placeCreate("x").payload, sourceUrl: "http://unsafe" },
      },
      {
        ...placeCreate("bad-latitude"),
        payload: { ...placeCreate("x").payload, latitude: 91 },
      },
      { ...placeCreate("bad-shape"), baseVersion: 1 },
    ];

    for (const body of cases) {
      const response = await postMutation(trip.id, body);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "MUTATION_INPUT_INVALID" },
      });
    }
  });

  it("rejects every cross-trip or nonexistent relationship reference", async () => {
    const trip = await seedTrip();
    const otherTrip = await seedTrip();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO trip_days (
          id, trip_id, day_date, title, position, version, updated_by, updated_at
        ) VALUES
          ('day-current', ?, '2026-09-10', 'Current', 0, 1, 'owner', ?),
          ('day-other', ?, '2026-09-10', 'Other', 0, 1, 'owner', ?)`
      ).bind(
        trip.id,
        fixedNow.toISOString(),
        otherTrip.id,
        fixedNow.toISOString()
      ),
      env.DB.prepare(
        `INSERT INTO places (
          id, trip_id, name, category, status, description, saved_by, version,
          updated_by, updated_at
        ) VALUES ('place-other', ?, 'Other', 'cafe', 'saved', '', 'owner', 1,
          'owner', ?)`
      ).bind(otherTrip.id, fixedNow.toISOString()),
      env.DB.prepare(
        `INSERT INTO bookings (
          id, trip_id, place_id, booking_type, provider, starts_at,
          payment_status, memo, is_fixed, version, updated_by, updated_at
        ) VALUES ('booking-other', ?, 'place-other', 'ticket', 'Other',
          '2026-09-10T10:00:00+10:00', 'paid', '', 1, 1, 'owner', ?)`
      ).bind(otherTrip.id, fixedNow.toISOString()),
      env.DB.prepare(
        `INSERT INTO schedule_items (
          id, trip_id, trip_day_id, place_id, booking_id, title, memo,
          travel_note, position, is_fixed, is_done, version, updated_by,
          updated_at
        ) VALUES ('schedule-other', ?, 'day-other', 'place-other',
          'booking-other', 'Other', '', '', 0, 0, 0, 1, 'owner', ?)`
      ).bind(otherTrip.id, fixedNow.toISOString()),
      env.DB.prepare(
        "DELETE FROM trip_members WHERE trip_id = ? AND member_id = 'partner'"
      ).bind(trip.id),
    ]);

    const schedulePayload = {
      tripDayId: "day-current",
      placeId: null,
      bookingId: null,
      title: "Schedule",
      startsAt: null,
      endsAt: null,
      memo: "",
      travelMode: null,
      travelNote: "",
      position: 0,
      isFixed: false,
      isDone: false,
    };
    const notePayload = {
      targetType: "place",
      targetId: "place-other",
      visibility: "shared",
      body: "Reference",
      attachmentUrl: null,
    };
    const cases: Array<{
      name: string;
      entity: string;
      payload: Record<string, unknown>;
    }> = [
      {
        name: "schedule-day-cross",
        entity: "schedule_item",
        payload: { ...schedulePayload, tripDayId: "day-other" },
      },
      {
        name: "schedule-day-missing",
        entity: "schedule_item",
        payload: { ...schedulePayload, tripDayId: "day-missing" },
      },
      {
        name: "schedule-place-cross",
        entity: "schedule_item",
        payload: { ...schedulePayload, placeId: "place-other" },
      },
      {
        name: "schedule-place-missing",
        entity: "schedule_item",
        payload: { ...schedulePayload, placeId: "place-missing" },
      },
      {
        name: "schedule-booking-cross",
        entity: "schedule_item",
        payload: { ...schedulePayload, bookingId: "booking-other" },
      },
      {
        name: "schedule-booking-missing",
        entity: "schedule_item",
        payload: { ...schedulePayload, bookingId: "booking-missing" },
      },
      {
        name: "booking-place-cross",
        entity: "booking",
        payload: {
          placeId: "place-other",
          bookingType: "ticket",
          provider: "Provider",
          startsAt: "2026-09-10T10:00:00+10:00",
          endsAt: null,
          reservationCode: null,
          paymentStatus: "paid",
          externalUrl: null,
          documentUrl: null,
          memo: "",
          isFixed: true,
          isRequired: false,
        },
      },
      {
        name: "booking-place-missing",
        entity: "booking",
        payload: {
          placeId: "place-missing",
          bookingType: "ticket",
          provider: "Provider",
          startsAt: "2026-09-10T10:00:00+10:00",
          endsAt: null,
          reservationCode: null,
          paymentStatus: "paid",
          externalUrl: null,
          documentUrl: null,
          memo: "",
          isFixed: true,
          isRequired: false,
        },
      },
      {
        name: "place-saved-by-non-member",
        entity: "place",
        payload: { ...placeCreate("ignored").payload, savedBy: "partner" },
      },
      {
        name: "place-saved-by-missing",
        entity: "place",
        payload: { ...placeCreate("ignored").payload, savedBy: "missing" },
      },
      {
        name: "check-owner-non-member",
        entity: "check_item",
        payload: {
          scope: "shared",
          ownerMemberId: "partner",
          assigneeMemberId: null,
          title: "Check",
          quantity: 1,
          memo: "",
          requirementKind: null,
          isDone: false,
          position: 0,
        },
      },
      {
        name: "check-owner-missing",
        entity: "check_item",
        payload: {
          scope: "shared",
          ownerMemberId: "missing",
          assigneeMemberId: null,
          title: "Check",
          quantity: 1,
          memo: "",
          requirementKind: null,
          isDone: false,
          position: 0,
        },
      },
      {
        name: "check-assignee-non-member",
        entity: "check_item",
        payload: {
          scope: "shared",
          ownerMemberId: null,
          assigneeMemberId: "partner",
          title: "Check",
          quantity: 1,
          memo: "",
          requirementKind: null,
          isDone: false,
          position: 0,
        },
      },
      {
        name: "check-assignee-missing",
        entity: "check_item",
        payload: {
          scope: "shared",
          ownerMemberId: null,
          assigneeMemberId: "missing",
          title: "Check",
          quantity: 1,
          memo: "",
          requirementKind: null,
          isDone: false,
          position: 0,
        },
      },
      {
        name: "expense-payer-missing",
        entity: "expense",
        payload: {
          phase: "travel",
          category: "food",
          title: "Dinner",
          amountMinor: 8_500,
          currency: "AUD",
          spentOn: "2026-09-10",
          paidByMemberId: "missing",
          expenseScope: "shared",
          personalForMemberId: null,
          paymentMethod: "card",
          isSettled: false,
          memo: "",
        },
      },
      {
        name: "note-trip-cross",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "trip",
          targetId: otherTrip.id,
        },
      },
      {
        name: "note-trip-missing",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "trip",
          targetId: "trip-missing",
        },
      },
      {
        name: "note-place-cross",
        entity: "note",
        payload: notePayload,
      },
      {
        name: "note-place-missing",
        entity: "note",
        payload: { ...notePayload, targetId: "place-missing" },
      },
      {
        name: "note-place-null",
        entity: "note",
        payload: { ...notePayload, targetId: null },
      },
      {
        name: "note-schedule-cross",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "schedule_item",
          targetId: "schedule-other",
        },
      },
      {
        name: "note-schedule-missing",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "schedule_item",
          targetId: "schedule-missing",
        },
      },
      {
        name: "note-schedule-null",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "schedule_item",
          targetId: null,
        },
      },
      {
        name: "note-booking-cross",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "booking",
          targetId: "booking-other",
        },
      },
      {
        name: "note-booking-missing",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "booking",
          targetId: "booking-missing",
        },
      },
      {
        name: "note-booking-null",
        entity: "note",
        payload: {
          ...notePayload,
          targetType: "booking",
          targetId: null,
        },
      },
      {
        name: "vote-place-cross",
        entity: "vote",
        payload: {
          targetType: "place",
          targetId: "place-other",
          choice: "must",
        },
      },
      {
        name: "vote-place-missing",
        entity: "vote",
        payload: {
          targetType: "place",
          targetId: "place-missing",
          choice: "must",
        },
      },
      {
        name: "vote-schedule-cross",
        entity: "vote",
        payload: {
          targetType: "schedule_item",
          targetId: "schedule-other",
          choice: "must",
        },
      },
      {
        name: "vote-schedule-missing",
        entity: "vote",
        payload: {
          targetType: "schedule_item",
          targetId: "schedule-missing",
          choice: "must",
        },
      },
    ];

    for (const [index, entry] of cases.entries()) {
      const response = await postMutation(trip.id, {
        idempotencyKey: `invalid-reference-${index}`,
        entity: entry.entity,
        action: "create",
        entityId: `invalid-reference-entity-${index}`,
        baseVersion: null,
        payload: entry.payload,
      });
      expect(
        { name: entry.name, status: response.status, body: await response.json() }
      ).toEqual({
        name: entry.name,
        status: 400,
        body: {
          error: {
            code: "MUTATION_REFERENCE_INVALID",
            message: "참조 대상이 올바르지 않습니다.",
          },
        },
      });
    }
    await expect(
      env.DB.prepare(
        `SELECT
          (SELECT sync_version FROM trips WHERE id = ?) AS sync_version,
          (SELECT COUNT(*) FROM mutation_receipts WHERE trip_id = ?) AS receipts,
          (SELECT COUNT(*) FROM activity_logs WHERE trip_id = ?) AS activities`
      ).bind(trip.id, trip.id, trip.id).first()
    ).resolves.toEqual({ sync_version: 0, receipts: 0, activities: 0 });
  });

  it("masks sensitive values and limits snapshot activity to 100 rows", async () => {
    const trip = await seedTrip();
    const booking = {
      idempotencyKey: "masked-booking",
      entity: "booking",
      action: "create",
      entityId: "booking-secret",
      baseVersion: null,
      payload: {
        placeId: null,
        bookingType: "flight",
        provider: "Qantas",
        startsAt: "2026-09-10T10:00:00+10:00",
        endsAt: null,
        reservationCode: "DO-NOT-LEAK",
        paymentStatus: "paid",
        externalUrl: null,
        documentUrl: "https://example.com/private-document",
        memo: "SECRET MEMO",
        isFixed: true,
        isRequired: true,
      },
    };
    expect((await postMutation(trip.id, booking)).status).toBe(200);
    const activityStatements = Array.from({ length: 100 }, (_, index) =>
      env.DB.prepare(
        `INSERT INTO activity_logs (
          id, trip_id, member_id, entity_type, entity_id, action, summary,
          created_at
        ) VALUES (?, ?, 'owner', 'place', ?, 'update', 'safe summary', ?)`
      ).bind(
        `activity-${String(index).padStart(3, "0")}`,
        trip.id,
        `place-${index}`,
        new Date(fixedNow.getTime() + index + 1).toISOString()
      )
    );
    for (let index = 0; index < activityStatements.length; index += 25) {
      await env.DB.batch(activityStatements.slice(index, index + 25));
    }

    const response = await request(
      "owner",
      `/api/trips/${trip.id}/snapshot`,
      { headers: headers("owner") }
    );
    const body = await response.json() as {
      activity: Array<{ summary: string }>;
    };
    const serialized = JSON.stringify(body.activity);

    expect(body.activity).toHaveLength(100);
    expect(serialized).not.toContain("DO-NOT-LEAK");
    expect(serialized).not.toContain("SECRET MEMO");
    expect(serialized).not.toContain("private-document");
  });

  it("does not reveal validation or receipts before membership checks", async () => {
    const trip = await seedTrip();
    const first = await postMutation(trip.id, placeCreate("member-key"));
    expect(first.status).toBe(200);
    await env.DB.prepare(
      "DELETE FROM trip_members WHERE trip_id = ? AND member_id = 'partner'"
    ).bind(trip.id).run();

    const response = await postMutation(
      trip.id,
      { idempotencyKey: "member-key" },
      "partner"
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TRIP_NOT_FOUND" },
    });
  });

  it("normalizes D1 quota errors without exposing raw details", async () => {
    const unavailable = {
      ...bindings("owner"),
      DB: {
        prepare() {
          throw new Error("D1_ERROR: free tier quota exceeded SQL SECRET");
        },
      } as unknown as D1Database,
    };

    const response = await request(
      "owner",
      "/api/trips/trip-one/snapshot",
      { headers: headers("owner") },
      unavailable
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "D1_UNAVAILABLE",
        message: "무료 한도 또는 일시적인 저장소 오류로 요청을 처리하지 못했습니다.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("SQL SECRET");
  });
});
