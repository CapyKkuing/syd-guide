import { describe, expect, it } from "vitest";
import type { Expense, PublicMember } from "../../shared/entities";
import { calculateSettlements } from "./settlement";

const members: PublicMember[] = [
  { id: "yeonjun", role: "owner", displayName: "연준" },
  { id: "minji", role: "partner", displayName: "민지" },
];

describe("calculateSettlements", () => {
  it("combines shared costs and a partner's personal item paid by the viewer", () => {
    const [settlement] = calculateSettlements([
      expense({ id: "shared", amountMinor: 10_000, expenseScope: "shared", personalForMemberId: null }),
      expense({ id: "personal", amountMinor: 2_000, expenseScope: "personal", personalForMemberId: "minji" }),
    ], members);

    if (!settlement) throw new Error("Expected an AUD settlement");

    expect(settlement.sharedAmountMinor).toBe(10_000);
    expect(settlement.personalAmountMinor).toBe(2_000);
    expect(settlement.transfers).toEqual([
      { fromMemberId: "minji", toMemberId: "yeonjun", amountMinor: 7_000 },
    ]);
  });

  it("leaves settled and unclassified historical expenses out of the calculation", () => {
    expect(calculateSettlements([
      expense({ id: "done", amountMinor: 10_000, expenseScope: "shared", personalForMemberId: null, isSettled: true }),
      expense({ id: "legacy", amountMinor: 10_000, expenseScope: null, personalForMemberId: null }),
    ], members)).toEqual([]);
  });

  it("creates separate transfers for a three-person shared payment", () => {
    const [settlement] = calculateSettlements([
      expense({ id: "shared", amountMinor: 30_000, expenseScope: "shared", personalForMemberId: null }),
    ], [...members, { id: "jiho", role: "partner", displayName: "지호" }]);

    if (!settlement) throw new Error("Expected an AUD settlement");

    expect(settlement.transfers).toEqual([
      { fromMemberId: "minji", toMemberId: "yeonjun", amountMinor: 10_000 },
      { fromMemberId: "jiho", toMemberId: "yeonjun", amountMinor: 10_000 },
    ]);
  });
});

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "expense",
    tripId: "trip",
    version: 1,
    updatedAt: "2026-07-31T00:00:00.000Z",
    updatedBy: "yeonjun",
    phase: "travel",
    category: "shopping",
    customCategory: null,
    title: "개인 물품",
    amountMinor: 1,
    currency: "AUD",
    spentOn: "2026-07-31",
    paidByMemberId: "yeonjun",
    expenseScope: "personal",
    personalForMemberId: "minji",
    paymentMethod: "card",
    isSettled: false,
    memo: "",
    ...overrides,
  };
}
