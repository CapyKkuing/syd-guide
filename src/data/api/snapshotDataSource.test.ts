import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/api/errors";
import { createTripSnapshot } from "../../test/snapshotSamples";
import { SnapshotTravelGuideDataSource } from "./snapshotDataSource";

describe("SnapshotTravelGuideDataSource", () => {
  it("maps an online server snapshot into the trip workspace", async () => {
    const snapshot = createTripSnapshot();
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockResolvedValue({
          snapshot,
          etag: "\"trip-one-7\"",
          notModified: false,
        }),
      },
      async () => ({ memberId: "owner", role: "owner" }),
      () => new Date("2026-09-10T01:00:00.000Z"),
    );

    const today = await source.getToday(snapshot.trip.id);

    expect(today?.localDate).toBe("2026-09-10");
    expect(today?.schedule).toHaveLength(2);
  });

  it("uses the server weather state without making a weather failure break the trip page", async () => {
    const snapshot = createTripSnapshot();
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockResolvedValue({
          snapshot,
          etag: null,
          notModified: false,
        }),
        getWeather: vi.fn().mockRejectedValue(new ApiClientError(
          429,
          "WEATHER_FREE_LIMIT_REACHED",
          "limit",
        )),
      },
      async () => ({ memberId: "owner", role: "owner" }),
    );

    const today = await source.getToday(snapshot.trip.id);

    expect(today?.weather).toMatchObject({
      status: "quota",
      message: "이번 달 날씨 무료 보호 한도에 도달했습니다.",
    });
  });

  it("does not expose cached trip data when the online API is unavailable", async () => {
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      },
      async () => ({ memberId: "owner", role: "owner" }),
    );

    await expect(source.getToday("trip-one"))
      .rejects.toThrow("인터넷 연결이 필요합니다");
  });

  it("reports a revoked partner session before redirecting to pairing", async () => {
    const onSessionInvalid = vi.fn();
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new ApiClientError(
          401,
          "SESSION_REVOKED",
          "기기 연결이 해제되었습니다.",
        )),
      },
      async () => ({ memberId: "partner", role: "partner" }),
      () => new Date(),
      { onSessionInvalid },
    );

    await expect(source.getToday("trip-one"))
      .rejects.toMatchObject({ status: 401, code: "SESSION_REVOKED" });
    expect(onSessionInvalid).toHaveBeenCalledTimes(1);
  });

  it("keeps Access expiry separate from partner session revocation", async () => {
    const onSessionInvalid = vi.fn();
    const source = new SnapshotTravelGuideDataSource(
      {
        getTripSnapshot: vi.fn().mockRejectedValue(new ApiClientError(
          401,
          "ACCESS_REQUIRED",
          "Cloudflare Access required",
        )),
      },
      async () => ({ memberId: "owner", role: "owner" }),
      () => new Date(),
      { onSessionInvalid },
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
        notModified: false,
      }),
    };
    const source = new SnapshotTravelGuideDataSource(
      client,
      async () => ({ memberId: "owner", role: "owner" }),
      () => new Date("2026-09-10T01:00:00.000Z"),
    );

    const [context, today, schedule, mapPreview, tools] = await Promise.all([
      source.getTripContext(snapshot.trip.id),
      source.getToday(snapshot.trip.id),
      source.getSchedule(snapshot.trip.id),
      source.getMapPreview(snapshot.trip.id),
      source.getTools(snapshot.trip.id),
    ]);

    expect(client.getTripSnapshot).toHaveBeenCalledTimes(1);
    expect(context?.trip.id).toBe(snapshot.trip.id);
    expect(today?.localDate).toBe("2026-09-10");
    expect(schedule?.days).toHaveLength(2);
    expect(mapPreview?.places).toHaveLength(3);
    expect(tools?.groups).toHaveLength(3);
  });

  it("reuses the in-memory snapshot on 304 and reads again after invalidation", async () => {
    const snapshot = createTripSnapshot();
    const client = {
      getTripSnapshot: vi.fn()
        .mockResolvedValueOnce({
          snapshot,
          etag: "\"trip-one-7\"",
          notModified: false,
        })
        .mockResolvedValueOnce({
          snapshot: null,
          etag: "\"trip-one-7\"",
          notModified: true,
        }),
    };
    const source = new SnapshotTravelGuideDataSource(
      client,
      async () => ({ memberId: "owner", role: "owner" }),
    );

    await source.getToday(snapshot.trip.id);
    source.invalidateTrip(snapshot.trip.id);
    const today = await source.getToday(snapshot.trip.id);

    expect(today?.schedule).toHaveLength(2);
    expect(client.getTripSnapshot).toHaveBeenNthCalledWith(
      2,
      snapshot.trip.id,
      "\"trip-one-7\"",
    );
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
        updatedAt: "2026-09-10T01:00:00.000Z",
      }],
      syncVersion: 8,
    };
    const client = {
      getTripSnapshot: vi.fn()
        .mockResolvedValueOnce({
          snapshot,
          etag: "\"trip-one-7\"",
          notModified: false,
        })
        .mockResolvedValueOnce({
          snapshot: null,
          etag: "\"trip-one-7\"",
          notModified: true,
        })
        .mockResolvedValueOnce({
          snapshot: freshSnapshot,
          etag: "\"trip-one-8\"",
          notModified: false,
        }),
    };
    const source = new SnapshotTravelGuideDataSource(
      client,
      async () => ({ memberId: "owner", role: "owner" }),
    );

    await source.getToday(snapshot.trip.id);
    source.invalidateTrip(snapshot.trip.id, 8);
    const today = await source.getToday(snapshot.trip.id);

    expect(today?.expenses).toHaveLength(1);
    expect(client.getTripSnapshot).toHaveBeenNthCalledWith(
      2,
      snapshot.trip.id,
      "\"trip-one-7\"",
    );
    expect(client.getTripSnapshot).toHaveBeenNthCalledWith(
      3,
      snapshot.trip.id,
      undefined,
    );
  });
});
