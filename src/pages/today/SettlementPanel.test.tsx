import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { Expense, PublicMember } from "../../shared/entities";
import type { SettlementGroupCreateRequest } from "../../shared/mutations";
import type { TripMutationController } from "../../services/mutations/controller";
import { SyncContext } from "../../services/sync/SyncContext";
import { SettlementPanel } from "./SettlementPanel";

const members: PublicMember[] = [
  { id: "owner", role: "owner", displayName: "연준" },
  { id: "partner", role: "partner", displayName: "민지" },
  { id: "friend", role: "partner", displayName: "친구" },
];

const expense: Expense = {
  id: "expense-shared",
  tripId: "trip-one",
  version: 1,
  updatedAt: "2026-08-03T00:00:00.000Z",
  updatedBy: "owner",
  phase: "travel",
  category: "food",
  customCategory: null,
  title: "함께 먹은 저녁",
  amountMinor: 30_000,
  currency: "AUD",
  spentOn: "2026-08-03",
  paidByMemberId: "owner",
  expenseScope: "shared",
  personalForMemberId: null,
  paymentMethod: "card",
  isSettled: false,
  memo: "",
};

describe("SettlementPanel", () => {
  it("submits two three-person transfers as one settlement group", async () => {
    const createSettlementGroup = vi.fn().mockResolvedValue({
      entity: "settlement_transfer",
      entityId: "group-one",
      version: 1,
      syncVersion: 2,
      transfers: [
        { entityId: "transfer-one", version: 1 },
        { entityId: "transfer-two", version: 1 },
      ],
    });
    const controller: TripMutationController = {
      submit: vi.fn(),
      createSettlementGroup,
    };
    render(
      <SettlementPanel
        controller={controller}
        expenses={[expense]}
        members={members}
        transfers={[]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "정산 송금 만들기" }));

    expect(createSettlementGroup).toHaveBeenCalledTimes(1);
    expect(createSettlementGroup).toHaveBeenCalledWith(
      ["expense-shared"],
      "AUD",
      [
        { fromMemberId: "partner", toMemberId: "owner", amountMinor: 10_000 },
        { fromMemberId: "friend", toMemberId: "owner", amountMinor: 10_000 },
      ]
    );
    expect(await screen.findAllByRole("button", { name: "송금 완료" }))
      .toHaveLength(2);
  });

  it("restores one queued group and blocks duplicate creation while offline", () => {
    const pending: SettlementGroupCreateRequest = {
      idempotencyKey: "batch-key",
      entity: "settlement_transfer",
      action: "create_group",
      entityId: "group-one",
      baseVersion: null,
      payload: {
        expenseIds: ["expense-shared"],
        currency: "AUD",
        transfers: [
          { entityId: "transfer-one", fromMemberId: "partner", toMemberId: "owner", amountMinor: 10_000 },
          { entityId: "transfer-two", fromMemberId: "friend", toMemberId: "owner", amountMinor: 10_000 },
        ],
      },
    };
    render(
      <SyncContext.Provider value={{
        online: false,
        queued: 1,
        conflicts: 0,
        lastSync: null,
        syncing: false,
        pendingMutations: [pending],
        syncNow: vi.fn(),
      }}>
        <SettlementPanel
          expenses={[expense]}
          members={members}
          transfers={[]}
        />
      </SyncContext.Provider>
    );

    expect(screen.getAllByRole("button", { name: "동기화 대기" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "정산 송금 만들기" }))
      .not.toBeInTheDocument();
  });

  it("replaces an optimistic transfer after the synced server version arrives", async () => {
    const controller: TripMutationController = {
      submit: vi.fn(),
      completeSettlementTransfer: vi.fn(),
      createSettlementGroup: vi.fn().mockResolvedValue({
        entity: "settlement_transfer",
        entityId: "group-one",
        version: 0,
        syncVersion: -1,
        transfers: [{ entityId: "transfer-one", version: 0 }],
      }),
    };
    const travelers = members.slice(0, 2);
    const view = render(
      <SettlementPanel
        controller={controller}
        expenses={[expense]}
        members={travelers}
        transfers={[]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "정산 송금 만들기" }));
    expect(screen.getByRole("button", { name: "동기화 대기" })).toBeDisabled();

    view.rerender(
      <SettlementPanel
        controller={controller}
        expenses={[expense]}
        members={travelers}
        transfers={[transfer("transfer-one", "partner")]}
      />
    );

    expect(screen.getByRole("button", { name: "송금 완료" })).toBeEnabled();
  });

  it("completes each transfer through the atomic command without separate expense mutations", async () => {
    const submit = vi.fn();
    const completeSettlementTransfer = vi.fn().mockImplementation(
      async (entityId: string, baseVersion: number) => ({
        entity: "settlement_transfer" as const,
        entityId,
        version: baseVersion + 1,
        syncVersion: 3,
      })
    );
    const controller: TripMutationController = {
      submit,
      completeSettlementTransfer,
    };
    render(
      <SettlementPanel
        controller={controller}
        expenses={[expense]}
        members={members}
        transfers={[
          transfer("transfer-one", "partner"),
          transfer("transfer-two", "friend"),
        ]}
      />
    );

    const [firstCompleteButton] = screen.getAllByRole("button", { name: "송금 완료" });
    expect(firstCompleteButton).toBeDefined();
    await userEvent.click(firstCompleteButton!);
    await userEvent.click(screen.getByRole("button", { name: "송금 완료" }));

    expect(completeSettlementTransfer).toHaveBeenNthCalledWith(
      1,
      "transfer-one",
      1,
      "group-one"
    );
    expect(completeSettlementTransfer).toHaveBeenNthCalledWith(
      2,
      "transfer-two",
      1,
      "group-one"
    );
    expect(submit).not.toHaveBeenCalled();
  });
});

function transfer(id: string, fromMemberId: string) {
  return {
    id,
    tripId: "trip-one",
    settlementGroupId: "group-one",
    expenseIds: ["expense-shared"],
    currency: "AUD",
    fromMemberId,
    toMemberId: "owner",
    amountMinor: 10_000,
    status: "pending" as const,
    completedAt: null,
    version: 1,
    updatedBy: "owner",
    updatedAt: "2026-08-03T00:00:00.000Z",
  };
}
