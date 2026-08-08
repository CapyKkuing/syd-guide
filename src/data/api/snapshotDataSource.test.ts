import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/api/errors";
import {
  openTravelDatabase,
  type TravelDatabase
} from "../../services/offline/database";
import { SnapshotStore } from "../../services/offline/snapshotStore";
import { createTripSnapshot } from "../../test/snapshotSamples";
import { SnapshotTravelGuideDataSource } from "./snapshotDataSource";

const databases: TravelDatabase[] = [];
const names: string[] = [];

async function createSnapshotStore() {
  const name = `couple-travel-guide-snapshot-${crypto.randomUUID()}`;
  const database = await openTravelDatabase(name);
  databases.push(database);
  names.push(name);
  return new SnapshotStore(database);
}

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(names.splice(0).map((name) => deleteDB(name)));
});

describe("SnapshotTravelGuideDataSource", () => {
  it("persists a network snapshot and principal for an offline start", async () => {
    const snapshot = createTripSnapshot();
    const snapshots = await createSnapshotStore();
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockResolvedValue({
          snapshot,
          etag: "\"trip-one-7\"",
          notModified: false
        })
      },
      async () => ({ memberId: "owner", role: "owner" }),
      () => new Date("2026-09-10T01:00:00.000Z"),
      { snapshots }
    );

    await source.getToday(snapshot.trip.id);

    expect(await snapshots.get(snapshot.trip.id)).toMatchObject({
      snapshot,
      etag: "\"trip-one-7\""
    });
    expect(await snapshots.getPrincipal()).toEqual({
      memberId: "owner",
      role: "owner"
    });
  });

  it("uses the durable snapshot and principal when an offline start cannot reach either API", async () => {
    const snapshot = createTripSnapshot();
    const snapshots = await createSnapshotStore();
    await snapshots.put({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });
    await snapshots.savePrincipal({ memberId: "owner", role: "owner" });
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      },
      async () => {
        throw new TypeError("Failed to fetch");
      },
      () => new Date("2026-09-10T01:00:00.000Z"),
      { snapshots }
    );

    const today = await source.getToday(snapshot.trip.id);

    expect(today?.localDate).toBe("2026-09-10");
    expect(today?.schedule).toHaveLength(2);
  });

  it("persists a queued schedule update for an offline cold start", async () => {
    const snapshot = createTripSnapshot();
    const item = snapshot.scheduleItems[0];
    if (!item) throw new Error("테스트 일정이 없습니다.");
    const snapshots = await createSnapshotStore();
    await snapshots.put({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      },
      async () => {
        throw new TypeError("Failed to fetch");
      },
      () => new Date("2026-09-10T01:00:00.000Z"),
      { snapshots }
    );

    await source.applyLocalMutation(snapshot.trip.id, {
      idempotencyKey: "offline-schedule-update",
      entity: "schedule_item",
      action: "update",
      entityId: item.id,
      baseVersion: item.version,
      payload: {
        tripDayId: item.tripDayId,
        placeId: item.placeId,
        bookingId: item.bookingId,
        title: item.title,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        memo: item.memo,
        travelMode: item.travelMode,
        travelNote: "QA-ANDROID-OFFLINE",
        position: 1,
        isFixed: item.isFixed,
        isDone: item.isDone,
      },
    }, "2026-08-08T12:00:00.000Z");

    const durable = await snapshots.get(snapshot.trip.id);
    expect(durable?.snapshot.scheduleItems.find((candidate) => candidate.id === item.id)).toMatchObject({
      position: 1,
      travelNote: "QA-ANDROID-OFFLINE",
      version: item.version + 1,
      updatedAt: "2026-08-08T12:00:00.000Z",
    });
    const schedule = await source.getSchedule(snapshot.trip.id);
    expect(schedule?.days.flatMap((day) => day.items).find((candidate) => candidate.id === item.id)).toMatchObject({
      position: 1,
      travelNote: "QA-ANDROID-OFFLINE",
      version: item.version + 1,
    });
  });

  it("opens a durable snapshot offline when legacy storage has no principal", async () => {
    const snapshot = createTripSnapshot();
    const snapshots = await createSnapshotStore();
    await snapshots.put({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      },
      async () => {
        throw new TypeError("Failed to fetch");
      },
      () => new Date("2026-09-10T01:00:00.000Z"),
      { snapshots }
    );

    const [today, context] = await Promise.all([
      source.getToday(snapshot.trip.id),
      source.getTripContext(snapshot.trip.id)
    ]);

    expect(today?.localDate).toBe("2026-09-10");
    expect(today?.schedule).toHaveLength(2);
    expect(context?.viewer).toMatchObject({
      memberId: "",
      access: "offline-readonly"
    });
  });

  it("clears the durable snapshot before reporting a revoked session", async () => {
    const snapshot = createTripSnapshot();
    const snapshots = await createSnapshotStore();
    await snapshots.put({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });
    await snapshots.savePrincipal({ memberId: "partner", role: "partner" });
    const onSessionInvalid = vi.fn();
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new ApiClientError(
          401,
          "SESSION_REVOKED",
          "기기 연결이 해제되었습니다."
        ))
      },
      async () => ({ memberId: "partner", role: "partner" }),
      () => new Date(),
      { snapshots, onSessionInvalid }
    );

    await expect(source.getToday(snapshot.trip.id))
      .rejects.toMatchObject({ status: 401 });

    expect(await snapshots.get(snapshot.trip.id)).toBeUndefined();
    expect(await snapshots.getPrincipal()).toBeNull();
    expect(onSessionInvalid).toHaveBeenCalledTimes(1);
  });

  it("keeps Access expiry separate from partner session revocation", async () => {
    const snapshots = await createSnapshotStore();
    const onSessionInvalid = vi.fn();
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new ApiClientError(
          401,
          "ACCESS_REQUIRED",
          "Cloudflare Access required"
        ))
      },
      async () => ({ memberId: "owner", role: "owner" }),
      () => new Date(),
      { snapshots, onSessionInvalid }
    );

    await expect(source.getToday("trip-one"))
      .rejects.toMatchObject({ status: 401, code: "ACCESS_REQUIRED" });
    expect(onSessionInvalid).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent snapshot reads for one trip", async () => {
    const snapshot = createTripSnapshot();
    const client = {
      getTripSnapshot: vi.fn().mockResolvedValue({
        snapshot,
        etag: "\"trip-one-7\"",
        notModified: false
      })
    };
    const source = new SnapshotTravelGuideDataSource(
      client,
      async () => ({ memberId: "owner", role: "owner" }),
      () => new Date("2026-09-10T01:00:00.000Z")
    );

    const [context, today, schedule, mapPreview, tools] = await Promise.all([
      source.getTripContext(snapshot.trip.id),
      source.getToday(snapshot.trip.id),
      source.getSchedule(snapshot.trip.id),
      source.getMapPreview(snapshot.trip.id),
      source.getTools(snapshot.trip.id)
    ]);

    expect(client.getTripSnapshot).toHaveBeenCalledTimes(1);
    expect(context?.trip.id).toBe(snapshot.trip.id);
    expect(today?.localDate).toBe("2026-09-10");
    expect(schedule?.days).toHaveLength(2);
    expect(mapPreview?.places).toHaveLength(3);
    expect(tools?.groups).toHaveLength(3);
  });

  it("reuses the cached snapshot on 304 and reads again after invalidation", async () => {
    const snapshot = createTripSnapshot();
    const client = {
      getTripSnapshot: vi.fn()
        .mockResolvedValueOnce({
          snapshot,
          etag: "\"trip-one-7\"",
          notModified: false
        })
        .mockResolvedValueOnce({
          snapshot: null,
          etag: "\"trip-one-7\"",
          notModified: true
        })
    };
    const source = new SnapshotTravelGuideDataSource(
      client,
      async () => ({ memberId: "owner", role: "owner" })
    );

    await source.getToday(snapshot.trip.id);
    source.invalidateTrip(snapshot.trip.id);
    const today = await source.getToday(snapshot.trip.id);

    expect(today?.schedule).toHaveLength(2);
    expect(client.getTripSnapshot).toHaveBeenNthCalledWith(2, snapshot.trip.id, "\"trip-one-7\"");
  });

  it("waits for the mutation sync version before exposing refreshed data", async () => {
    const snapshot = createTripSnapshot();
    const freshSnapshot = {
      ...snapshot,
      expenses: [{
        id: "expense-qa",
        tripId: snapshot.trip.id,
        phase: "pretrip" as const,
        category: "reservation" as const,
        title: "동기화 확인",
        amountMinor: 1,
        currency: "KRW",
        spentOn: "2026-09-10",
        paidByMemberId: "owner",
        expenseScope: "shared" as const,
        personalForMemberId: null,
        paymentMethod: "card" as const,
        isSettled: false,
        memo: "",
        version: 1,
        updatedBy: "owner",
        updatedAt: "2026-09-10T01:00:00.000Z"
      }],
      syncVersion: 8
    };
    const client = {
      getTripSnapshot: vi.fn()
        .mockResolvedValueOnce({
          snapshot,
          etag: "\"trip-one-7\"",
          notModified: false
        })
        .mockResolvedValueOnce({
          snapshot: null,
          etag: "\"trip-one-7\"",
          notModified: true
        })
        .mockResolvedValueOnce({
          snapshot: freshSnapshot,
          etag: "\"trip-one-8\"",
          notModified: false
        })
    };
    const source = new SnapshotTravelGuideDataSource(
      client,
      async () => ({ memberId: "owner", role: "owner" })
    );

    await source.getToday(snapshot.trip.id);
    source.invalidateTrip(snapshot.trip.id, 8);
    const today = await source.getToday(snapshot.trip.id);

    expect(today?.expenses).toHaveLength(1);
    expect(client.getTripSnapshot).toHaveBeenNthCalledWith(2, snapshot.trip.id, "\"trip-one-7\"");
    expect(client.getTripSnapshot).toHaveBeenNthCalledWith(3, snapshot.trip.id, undefined);
  });
});
