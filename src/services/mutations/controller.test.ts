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
  it("blocks a mutation before transport when the device is offline", async () => {
    const transport = {
      mutate: vi.fn().mockResolvedValue({
        entity: "schedule_item",
        entityId: "schedule-one",
        version: 2,
        syncVersion: 8,
      }),
    };
    const dataSource = { invalidateTrip: vi.fn() };
    const reload = vi.fn();
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource,
      reload,
      isOnline: () => false,
    });

    await expect(controller.submit(
      "schedule_item",
      "update",
      "schedule-one",
      1,
      payload,
    )).rejects.toThrow("인터넷 연결이 필요합니다");
    expect(transport.mutate).not.toHaveBeenCalled();
    expect(dataSource.invalidateTrip).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
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

  it("sends one atomic schedule reorder directly to the server", async () => {
    const transport = {
      mutate: vi.fn().mockResolvedValue({
        entity: "schedule_item",
        entityId: "day-one",
        syncVersion: 12,
        items: [
          { entityId: "item-four", version: 2 },
          { entityId: "item-one", version: 3 },
        ],
      }),
    };
    const dataSource = { invalidateTrip: vi.fn() };
    const reload = vi.fn();
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource,
      reload,
      createId: () => "schedule-reorder-key",
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
    expect(transport.mutate).toHaveBeenCalledTimes(1);
    expect(transport.mutate).toHaveBeenCalledWith("trip-one", mutation);
    expect(result?.items).toEqual([
      { entityId: "item-four", version: 2 },
      { entityId: "item-one", version: 3 },
    ]);
    expect(dataSource.invalidateTrip).toHaveBeenCalledWith("trip-one", 12);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("sends a three-person settlement directly as one server mutation", async () => {
    const transport = {
      mutate: vi.fn().mockResolvedValue({
        entity: "settlement_transfer",
        entityId: "group-one",
        syncVersion: 13,
        transfers: [
          { entityId: "transfer-one", version: 1 },
          { entityId: "transfer-two", version: 1 },
        ],
      }),
    };
    const ids = ["batch-key", "group-one", "transfer-one", "transfer-two"];
    const dataSource = { invalidateTrip: vi.fn() };
    const reload = vi.fn();
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport,
      dataSource,
      reload,
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

    expect(transport.mutate).toHaveBeenCalledTimes(1);
    expect(transport.mutate).toHaveBeenCalledWith("trip-one", {
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
    });
    expect(result?.transfers).toEqual([
      { entityId: "transfer-one", version: 1 },
      { entityId: "transfer-two", version: 1 },
    ]);
    expect(dataSource.invalidateTrip).toHaveBeenCalledWith("trip-one", 13);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("converts a network failure into the online-required message", async () => {
    const controller = createTripMutationController({
      tripId: "trip-one",
      transport: { mutate: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) },
      dataSource: { invalidateTrip: vi.fn() },
      reload: vi.fn(),
      isOnline: () => true,
    });

    await expect(controller.submit(
      "schedule_item",
      "update",
      "schedule-one",
      1,
      payload,
    )).rejects.toThrow("인터넷 연결이 필요합니다");
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
