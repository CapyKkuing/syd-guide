import type { Expense, PublicMember } from "../../shared/entities";

export interface SettlementTransfer {
  amountMinor: number;
  fromMemberId: string;
  toMemberId: string;
}

export interface SettlementCurrency {
  currency: string;
  expenseIds: string[];
  personalAmountMinor: number;
  sharedAmountMinor: number;
  totalsByMemberId: Map<string, number>;
  transfers: SettlementTransfer[];
}

export function calculateSettlements(
  expenses: Expense[],
  members: PublicMember[],
): SettlementCurrency[] {
  const groups = new Map<string, Expense[]>();
  for (const expense of expenses) {
    if (expense.isSettled || expense.expenseScope === null) continue;
    if (expense.expenseScope === "personal" && expense.personalForMemberId === null) continue;
    groups.set(expense.currency, [...(groups.get(expense.currency) ?? []), expense]);
  }

  return [...groups.entries()].map(([currency, group]) => calculateCurrency(currency, group, members));
}

function calculateCurrency(
  currency: string,
  expenses: Expense[],
  members: PublicMember[],
): SettlementCurrency {
  const balances = new Map(members.map((member) => [member.id, 0]));
  const totalsByMemberId = new Map(members.map((member) => [member.id, 0]));
  let sharedAmountMinor = 0;
  let personalAmountMinor = 0;

  for (const expense of expenses) {
    totalsByMemberId.set(
      expense.paidByMemberId,
      (totalsByMemberId.get(expense.paidByMemberId) ?? 0) + expense.amountMinor,
    );
    balances.set(
      expense.paidByMemberId,
      (balances.get(expense.paidByMemberId) ?? 0) + expense.amountMinor,
    );

    if (expense.expenseScope === "shared") {
      sharedAmountMinor += expense.amountMinor;
      members.forEach((member, index) => {
        const share = Math.floor(expense.amountMinor / members.length)
          + (index < expense.amountMinor % members.length ? 1 : 0);
        balances.set(member.id, (balances.get(member.id) ?? 0) - share);
      });
    } else if (expense.personalForMemberId) {
      personalAmountMinor += expense.amountMinor;
      balances.set(
        expense.personalForMemberId,
        (balances.get(expense.personalForMemberId) ?? 0) - expense.amountMinor,
      );
    }
  }

  return {
    currency,
    expenseIds: expenses.map((expense) => expense.id),
    personalAmountMinor,
    sharedAmountMinor,
    totalsByMemberId,
    transfers: settleBalances(balances),
  };
}

function settleBalances(balances: Map<string, number>): SettlementTransfer[] {
  const creditors = [...balances.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amountMinor]) => ({ memberId, amountMinor }));
  const debtors = [...balances.entries()]
    .filter(([, amount]) => amount < 0)
    .map(([memberId, amountMinor]) => ({ memberId, amountMinor: -amountMinor }));
  const transfers: SettlementTransfer[] = [];

  while (creditors.length && debtors.length) {
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amountMinor = Math.min(creditor.amountMinor, debtor.amountMinor);
    transfers.push({ amountMinor, fromMemberId: debtor.memberId, toMemberId: creditor.memberId });
    creditor.amountMinor -= amountMinor;
    debtor.amountMinor -= amountMinor;
    if (creditor.amountMinor === 0) creditors.shift();
    if (debtor.amountMinor === 0) debtors.shift();
  }

  return transfers;
}
