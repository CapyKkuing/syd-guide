import { describe, expect, it, vi } from "vitest";
import type {
  MutationPayloadMap,
  MutationRequest
} from "../../shared/mutations";
import {
  createOutboxMutationTransport,
  createTripMutationController
} from "./controller";

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
  it("persists the controller idempotency key before acknowledging an offline mutation", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const transport = createOutboxMutationTransport(
      { enqueue },
      () => new Date("2026-07-28T12:00:00.000Z")
    );
    const mutation: MutationRequest<"schedule_item"> = {
      idempotencyKey: "stable-offline-key",
      entity: "schedule_item",
      action: "create",
      entityId: "schedule-new",
      baseVersion: null,
      payload
    };

    const result = await transport.mutate("trip-one", mutation);

    expect(enqueue).toHaveBeenCalledWith(
      "trip-one",
      mutation,
      "2026-07-28T12:00:00.000Z"
    );
    expect(result).toEqual({
      entity: "schedule_item",
      entityId: "schedule-new",
      version: 0,
      syncVersion: -1
    });
  });

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
    expect(dataSource.invalidateTrip).toHaveBeenCalledWith("trip-one", 8);
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
