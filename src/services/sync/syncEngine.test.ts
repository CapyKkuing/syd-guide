import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MutationRequest,
  SettlementGroupCreateRequest,
  SyncMutationRequest,
} from "../../shared/mutations";
import { createTripSnapshot } from "../../test/snapshotSamples";
import { ApiClientError } from "../api/errors";
import {
  openTravelDatabase,
  type TravelDatabase
} from "../offline/database";
import { OutboxStore } from "../offline/outboxStore";
import { SnapshotStore } from "../offline/snapshotStore";
import { SyncEngine } from "./syncEngine";

const databases: TravelDatabase[] = [];
const names: string[] = [];

async function setup() {
  const name = `couple-travel-guide-sync-${crypto.randomUUID()}`;
  const database = await openTravelDatabase(name);
  databases.push(database);
  names.push(name);
  return {
    outbox: new OutboxStore(database),
    snapshots: new SnapshotStore(database)
  };
}

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(names.splice(0).map((name) => deleteDB(name)));
});

function mutation(idempotencyKey: string, entityId: string): MutationRequest<"note"> {
  return {
    idempotencyKey,
    entity: "note",
    action: "create",
    entityId,
    baseVersion: null,
    payload: {
      targetType: "trip",
      targetId: null,
      visibility: "shared",
      body: entityId,
      attachmentUrl: null
    }
  };
}

function success(request: MutationRequest) {
  return {
    entity: request.entity,
    entityId: request.entityId,
    version: 1,
    syncVersion: 8
  };
}

function settlementGroup(): SettlementGroupCreateRequest {
  return {
    idempotencyKey: "settlement-batch-key",
    entity: "settlement_transfer",
    action: "create_group",
    entityId: "settlement-group",
    baseVersion: null,
    payload: {
      expenseIds: ["expense-one"],
      currency: "AUD",
      transfers: [
        { entityId: "transfer-one", fromMemberId: "member-two", toMemberId: "owner", amountMinor: 10_000 },
        { entityId: "transfer-two", fromMemberId: "member-three", toMemberId: "owner", amountMinor: 10_000 },
      ],
    },
  };
}

describe("SyncEngine", () => {
  it("replays mutations in creation order with the same idempotency keys", async () => {
    const { outbox, snapshots } = await setup();
    const first = mutation("same-key-one", "note-one");
    const second = mutation("same-key-two", "note-two");
    await outbox.enqueue("trip-one", second, "2026-07-28T12:00:02.000Z");
    await outbox.enqueue("trip-one", first, "2026-07-28T12:00:01.000Z");
    const transport = { mutate: vi.fn(async (_tripId, request) => success(request)) };
    const engine = new SyncEngine({ outbox, snapshots, transport });

    const result = await engine.flush("trip-one");

    expect(transport.mutate.mock.calls.map((call) => call[1].idempotencyKey))
      .toEqual(["same-key-one", "same-key-two"]);
    expect(await outbox.listForTrip("trip-one")).toEqual([]);
    expect(result).toEqual({ sent: 2, conflict: false, sessionInvalid: false });
  });

  it("retries a network failure on the next trigger without changing its key", async () => {
    const { outbox, snapshots } = await setup();
    const queued = mutation("stable-key", "note-one");
    await outbox.enqueue("trip-one", queued);
    const transport = {
      mutate: vi.fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(success(queued))
    };
    const engine = new SyncEngine({ outbox, snapshots, transport });

    await engine.flush("trip-one");
    expect(await outbox.get("stable-key")).toMatchObject({
      state: "queued",
      attempts: 1,
      lastErrorCode: "NETWORK_ERROR"
    });

    await engine.flush("trip-one");
    expect(transport.mutate.mock.calls.map((call) => call[1].idempotencyKey))
      .toEqual(["stable-key", "stable-key"]);
    expect(await outbox.get("stable-key")).toBeUndefined();
  });

  it("retries one settlement group command without splitting its transfers", async () => {
    const { outbox, snapshots } = await setup();
    const queued = settlementGroup();
    await outbox.enqueue("trip-one", queued);
    const transport = {
      mutate: vi.fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce({
          entity: "settlement_transfer" as const,
          entityId: queued.entityId,
          version: 1,
          syncVersion: 9,
          transfers: queued.payload.transfers.map(({ entityId }) => ({ entityId, version: 1 })),
        })
    };
    const engine = new SyncEngine({ outbox, snapshots, transport });

    await engine.flush("trip-one");
    await engine.flush("trip-one");

    expect(transport.mutate).toHaveBeenCalledTimes(2);
    expect(transport.mutate.mock.calls.map((call) => call[1] as SyncMutationRequest))
      .toEqual([queued, queued]);
    expect(await outbox.listForTrip("trip-one")).toEqual([]);
  });

  it("marks a version conflict and stops before later records", async () => {
    const { outbox, snapshots } = await setup();
    const first = mutation("conflict-key", "note-one");
    const second = mutation("later-key", "note-two");
    await outbox.enqueue("trip-one", first, "2026-07-28T12:00:01.000Z");
    await outbox.enqueue("trip-one", second, "2026-07-28T12:00:02.000Z");
    const transport = {
      mutate: vi.fn().mockRejectedValue(new ApiClientError(
        409,
        "VERSION_CONFLICT",
        "다른 기기에서 항목이 수정되었습니다.",
        { current: { id: "note-one", version: 4, body: "최신 메모" } }
      ))
    };
    const engine = new SyncEngine({ outbox, snapshots, transport });

    const result = await engine.flush("trip-one");

    expect(await outbox.get("conflict-key")).toMatchObject({
      state: "conflict",
      conflictCurrent: { id: "note-one", version: 4, body: "최신 메모" }
    });
    expect(await outbox.get("later-key")).toMatchObject({ state: "queued" });
    expect(transport.mutate).toHaveBeenCalledTimes(1);
    expect(result.conflict).toBe(true);
  });

  it("clears every local snapshot and mutation before reporting an invalid session", async () => {
    const { outbox, snapshots } = await setup();
    const snapshot = createTripSnapshot();
    await snapshots.put({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });
    await snapshots.savePrincipal({ memberId: "partner", role: "partner" });
    await outbox.enqueue(snapshot.trip.id, mutation("revoked-key", "note-one"));
    const onSessionInvalid = vi.fn();
    const engine = new SyncEngine({
      outbox,
      snapshots,
      transport: {
        mutate: vi.fn().mockRejectedValue(new ApiClientError(
          401,
          "SESSION_REVOKED",
          "기기 연결이 해제되었습니다."
        ))
      },
      onSessionInvalid
    });

    const result = await engine.flush(snapshot.trip.id);

    expect(await snapshots.get(snapshot.trip.id)).toBeUndefined();
    expect(await snapshots.getPrincipal()).toBeNull();
    expect(await outbox.listForTrip(snapshot.trip.id)).toEqual([]);
    expect(onSessionInvalid).toHaveBeenCalledTimes(1);
    expect(result.sessionInvalid).toBe(true);
  });

  it("keeps overlapping triggers on one in-flight flush", async () => {
    const { outbox, snapshots } = await setup();
    const queued = mutation("single-key", "note-one");
    await outbox.enqueue("trip-one", queued);
    let resolveMutation!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    const transport = {
      mutate: vi.fn(async () => {
        await pending;
        return success(queued);
      })
    };
    const engine = new SyncEngine({ outbox, snapshots, transport });

    const first = engine.flush("trip-one");
    const second = engine.flush("trip-one");
    await vi.waitFor(() => expect(transport.mutate).toHaveBeenCalledTimes(1));

    resolveMutation();
    await Promise.all([first, second]);
    expect(transport.mutate).toHaveBeenCalledTimes(1);
  });

  it("uses the latest server content by dropping the conflict and cached snapshot", async () => {
    const { outbox, snapshots } = await setup();
    const snapshot = createTripSnapshot();
    await snapshots.put({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });
    const conflicting = mutation("conflict-key", "note-one");
    await outbox.enqueue(snapshot.trip.id, conflicting);
    await outbox.markConflict("conflict-key", "VERSION_CONFLICT", {
      id: "note-one",
      version: 4,
      body: "최신 메모"
    });
    const engine = new SyncEngine({
      outbox,
      snapshots,
      transport: { mutate: vi.fn() }
    });

    await engine.useLatest(snapshot.trip.id, "conflict-key");

    expect(await outbox.get("conflict-key")).toBeUndefined();
    expect(await snapshots.get(snapshot.trip.id)).toBeUndefined();
  });

  it("keeps my payload without merging and replaces the server base version and key", async () => {
    const { outbox, snapshots } = await setup();
    const conflicting = mutation("conflict-key", "note-one");
    await outbox.enqueue("trip-one", conflicting);
    await outbox.markConflict("conflict-key", "VERSION_CONFLICT", {
      id: "note-one",
      version: 4,
      body: "최신 메모"
    });
    const engine = new SyncEngine({
      outbox,
      snapshots,
      transport: { mutate: vi.fn() }
    });

    await engine.keepMine(
      "conflict-key",
      "replacement-key",
      "2026-07-28T12:01:00.000Z"
    );

    expect(await outbox.get("conflict-key")).toBeUndefined();
    expect(await outbox.get("replacement-key")).toMatchObject({
      state: "queued",
      mutation: {
        ...conflicting,
        idempotencyKey: "replacement-key",
        baseVersion: 4
      }
    });
  });
});
