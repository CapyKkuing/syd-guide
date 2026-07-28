import { describe, expect, it, vi } from "vitest";
import type { MutationPayloadMap } from "../../shared/mutations";
import { createTripMutationController } from "./controller";

const payload: MutationPayloadMap["schedule_item"] = {
  tripDayId: "day-one",
  placeId: null,
  bookingId: null,
  title: "새 일정",
  startsAt: "2026-09-10T14:00:00+10:00",
  endsAt: null,
  memo: "",
  travelMode: null,
  travelNote: "",
  position: 3,
  isFixed: false,
  isDone: false
};

describe("createTripMutationController", () => {
  it("creates one idempotent schedule mutation then reloads", async () => {
    const transport = {
      mutate: vi.fn().mockResolvedValue({
        entity: "schedule_item",
        entityId: "schedule-new",
        version: 1,
        syncVersion: 8
      })
    };
    const dataSource = { invalidateTrip: vi.fn() };
    const reload = vi.fn();
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource,
      reload,
      createId: () => "mutation-key"
    });

    const result = await controller.submit(
      "schedule_item",
      "create",
      "schedule-new",
      null,
      payload
    );

    expect(result.syncVersion).toBe(8);
    expect(transport.mutate).toHaveBeenCalledWith("trip-one", {
      idempotencyKey: "mutation-key",
      entity: "schedule_item",
      action: "create",
      entityId: "schedule-new",
      baseVersion: null,
      payload
    });
    expect(dataSource.invalidateTrip).toHaveBeenCalledWith("trip-one");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate or reload when the mutation fails", async () => {
    const transport = { mutate: vi.fn().mockRejectedValue(new Error("conflict")) };
    const dataSource = { invalidateTrip: vi.fn() };
    const reload = vi.fn();
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource,
      reload
    });

    await expect(controller.submit(
      "schedule_item",
      "delete",
      "schedule-one",
      3,
      null
    )).rejects.toThrow("conflict");
    expect(dataSource.invalidateTrip).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
