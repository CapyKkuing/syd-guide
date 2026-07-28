import { describe, expect, it, vi } from "vitest";
import { createTripSnapshot } from "../../test/snapshotSamples";
import { SnapshotTravelGuideDataSource } from "./snapshotDataSource";

describe("SnapshotTravelGuideDataSource", () => {
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
