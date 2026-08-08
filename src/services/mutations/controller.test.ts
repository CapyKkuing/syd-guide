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

  it("applies a queued schedule mutation locally before reloading", async () => {
    const transport = {
      mutate: vi.fn().mockResolvedValue({
        entity: "schedule_item",
        entityId: "schedule-one",
        version: 1,
        syncVersion: -1
      })
    };
    const dataSource = {
      applyLocalMutation: vi.fn().mockResolvedValue(undefined),
      invalidateTrip: vi.fn(),
    };
    const reload = vi.fn();
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource,
      reload,
      createId: () => "offline-mutation-key",
      clock: () => new Date("2026-08-08T12:00:00.000Z")
    });

    await controller.submit(
      "schedule_item",
      "update",
      "schedule-one",
      1,
      payload
    );

    const mutation = {
      idempotencyKey: "offline-mutation-key",
      entity: "schedule_item" as const,
      action: "update" as const,
      entityId: "schedule-one",
      baseVersion: 1,
      payload
    };
    expect(dataSource.applyLocalMutation).toHaveBeenCalledWith(
      "trip-one",
      mutation,
      "2026-08-08T12:00:00.000Z"
    );
    const applyOrder = dataSource.applyLocalMutation.mock.invocationCallOrder[0];
    const invalidateOrder = dataSource.invalidateTrip.mock.invocationCallOrder[0];
    if (applyOrder === undefined || invalidateOrder === undefined) {
      throw new Error("로컬 반영과 무효화 호출 순서를 확인하지 못했습니다.");
    }
    expect(applyOrder).toBeLessThan(invalidateOrder);
    expect(dataSource.invalidateTrip).toHaveBeenCalledWith("trip-one", -1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("queues one atomic schedule reorder and applies every position locally", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const transport = createOutboxMutationTransport(
      { enqueue },
      () => new Date("2026-08-08T12:00:00.000Z")
    );
    const dataSource = {
      applyLocalMutation: vi.fn().mockResolvedValue(undefined),
      invalidateTrip: vi.fn(),
    };
    const reload = vi.fn();
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource,
      reload,
      createId: () => "schedule-reorder-key",
      clock: () => new Date("2026-08-08T12:00:00.000Z")
    });
    const items = [
      { entityId: "item-four", baseVersion: 1, position: 1 },
      { entityId: "item-one", baseVersion: 2, position: 2 },
    ];

    const result = await controller.reorderScheduleItems?.("day-one", items);

    const mutation = {
      idempotencyKey: "schedule-reorder-key",
      entity: "schedule_item" as const,
      action: "reorder" as const,
      entityId: "day-one",
      baseVersion: null,
      payload: { items },
    };
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      "trip-one",
      mutation,
      "2026-08-08T12:00:00.000Z"
    );
    expect(dataSource.applyLocalMutation).toHaveBeenCalledWith(
      "trip-one",
      mutation,
      "2026-08-08T12:00:00.000Z"
    );
    expect(result?.items).toEqual([
      { entityId: "item-four", version: 2 },
      { entityId: "item-one", version: 3 },
    ]);
    expect(dataSource.invalidateTrip).toHaveBeenCalledWith("trip-one", -1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("queues a three-person settlement as one stable outbox record", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const transport = createOutboxMutationTransport(
      { enqueue },
      () => new Date("2026-08-03T12:00:00.000Z")
    );
    const ids = ["batch-key", "group-one", "transfer-one", "transfer-two"];
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource: { invalidateTrip: vi.fn() },
      reload: vi.fn(),
      createId: () => ids.shift() ?? "unexpected-id"
    });

    const result = await controller.createSettlementGroup?.(
      ["expense-one"],
      "AUD",
      [
        { fromMemberId: "member-two", toMemberId: "owner", amountMinor: 10_000 },
        { fromMemberId: "member-three", toMemberId: "owner", amountMinor: 10_000 },
      ]
    );

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith("trip-one", {
      idempotencyKey: "batch-key",
      entity: "settlement_transfer",
      action: "create_group",
      entityId: "group-one",
      baseVersion: null,
      payload: {
        expenseIds: ["expense-one"],
        currency: "AUD",
        transfers: [
          { entityId: "transfer-one", fromMemberId: "member-two", toMemberId: "owner", amountMinor: 10_000 },
          { entityId: "transfer-two", fromMemberId: "member-three", toMemberId: "owner", amountMinor: 10_000 },
        ],
      },
    }, "2026-08-03T12:00:00.000Z");
    expect(result?.transfers).toEqual([
      { entityId: "transfer-one", version: 0 },
      { entityId: "transfer-two", version: 0 },
    ]);
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
