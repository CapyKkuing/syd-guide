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
});
