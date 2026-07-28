import { describe, expect, it } from "vitest";
import { createTripSnapshot } from "../../test/snapshotSamples";
import { mapSnapshotToWorkspace } from "./snapshotMappers";

const now = new Date("2026-09-10T01:00:00.000Z");

describe("mapSnapshotToWorkspace", () => {
  it("maps one snapshot into the current four-tab workspace", () => {
    const snapshot = createTripSnapshot();
    const workspace = mapSnapshotToWorkspace(
      snapshot,
      { memberId: "owner", role: "owner" },
      now
    );

    expect(workspace.context.trip.id).toBe(snapshot.trip.id);
    expect(workspace.context.trip.phase).toBe("active");
    expect(workspace.context.localDate).toBe("2026-09-10");
    expect(workspace.context.viewer).toEqual({
      displayName: "연준",
      role: "owner"
    });
    expect(workspace.context.partnerStatus).toBe("connected");
    expect(workspace.schedule.days.map((day) => day.id)).toEqual([
      "day-one",
      "day-two"
    ]);
    expect(workspace.schedule.days[0]?.items.map((item) => item.id)).toEqual([
      "schedule-movement",
      "schedule-dinner"
    ]);
    expect(workspace.schedule.days[0]?.items[0]).toMatchObject({
      tripDayId: "day-one",
      placeId: "place-opera",
      place: "Sydney Opera House",
      kind: "movement",
      version: 1
    });
    expect(workspace.schedule.days[0]?.items[1]).toMatchObject({
      bookingId: "booking-dinner",
      place: "Quay",
      kind: "booking",
      isFixed: true
    });
    expect(workspace.tools.groups).toHaveLength(3);
  });

  it("selects the real active Today data and keeps sample-only cards labelled", () => {
    const workspace = mapSnapshotToWorkspace(
      createTripSnapshot(),
      { memberId: "partner", role: "partner" },
      now
    );

    expect(workspace.today.localDate).toBe("2026-09-10");
    expect(workspace.today.schedule.map((item) => item.id)).toEqual([
      "schedule-movement",
      "schedule-dinner"
    ]);
    expect(workspace.today.nextMovement).toMatchObject({
      departureTime: "13:00",
      destination: "Sydney Opera House",
      mode: "transit"
    });
    expect(workspace.today.booking).toEqual({
      place: "Quay",
      time: "20:00",
      type: "레스토랑",
      status: "confirmed"
    });
    expect(workspace.today.weather.isSample).toBe(true);
    expect(workspace.today.budget.isSample).toBe(true);
  });

  it("uses the last day and real completion counts for a completed trip", () => {
    const snapshot = createTripSnapshot();
    snapshot.trip.status = "completed";
    snapshot.scheduleItems = snapshot.scheduleItems.map((item) => ({
      ...item,
      isDone: true
    }));

    const workspace = mapSnapshotToWorkspace(
      snapshot,
      { memberId: "owner", role: "owner" },
      new Date("2026-09-20T00:00:00.000Z")
    );

    expect(workspace.today.localDate).toBe("2026-09-11");
    expect(workspace.today.schedule.map((item) => item.id)).toEqual([
      "schedule-bondi"
    ]);
    expect(workspace.today.summary).toEqual({
      visitedPlaceCount: 1,
      completedItemCount: 3
    });
  });

  it("normalizes valid coordinates and keeps coordinate-less places out of markers only", () => {
    const workspace = mapSnapshotToWorkspace(
      createTripSnapshot(),
      { memberId: "owner", role: "owner" },
      now
    );
    const opera = workspace.mapPreview.places.find((place) => place.id === "place-opera");
    const bondi = workspace.mapPreview.places.find((place) => place.id === "place-bondi");
    const quay = workspace.mapPreview.places.find((place) => place.id === "place-dinner");

    expect(opera).toMatchObject({ x: 0, y: 0 });
    expect(bondi).toMatchObject({ x: 100, y: 70 });
    expect(quay).toMatchObject({ x: null, y: null });
  });
});
