import { useMemo, useState } from "react";
import type { Expense, PublicMember } from "../../shared/entities";
import type { TripMutationController } from "../../services/mutations/controller";
import { calculateSettlements, type SettlementCurrency } from "./settlement";

export function SettlementPanel({
  controller,
  expenses,
  members,
}: {
  controller?: TripMutationController;
  expenses: Expense[];
  members: PublicMember[];
}) {
  const [resolvedExpenseIds, setResolvedExpenseIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const settlements = useMemo(
    () => calculateSettlements(expenses.filter((expense) => !resolvedExpenseIds.includes(expense.id)), members),
    [expenses, members, resolvedExpenseIds],
  );

  async function markSettled(summary: SettlementCurrency) {
    if (!controller) return;
    setError("");
    try {
      await Promise.all(summary.expenseIds.map((expenseId) => {
        const expense = expenses.find((item) => item.id === expenseId);
        if (!expense) return Promise.resolve();
        return controller.submit("expense", "update", expense.id, expense.version, {
          phase: expense.phase,
          category: expense.category,
          customCategory: expense.customCategory,
          title: expense.title,
          amountMinor: expense.amountMinor,
          currency: expense.currency,
          spentOn: expense.spentOn,
          paidByMemberId: expense.paidByMemberId,
          expenseScope: expense.expenseScope,
          personalForMemberId: expense.personalForMemberId,
          paymentMethod: expense.paymentMethod,
          isSettled: true,
          memo: expense.memo,
        });
      }));
      setResolvedExpenseIds((ids) => [...ids, ...summary.expenseIds]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "정산 완료 상태를 저장하지 못했습니다.");
    }
  }

  if (!settlements.length) return null;

  return (
    <section className="settlement-panel" aria-labelledby="settlement-title">
      <p className="today-section-heading__eyebrow">SETTLEMENT</p>
      <h2 id="settlement-title">정산하기</h2>
      <p className="settlement-panel__intro">함께 쓴 비용과 대신 결제한 개인 비용만 계산했어요.</p>
      {settlements.map((summary) => {
        const transfer = summary.transfers[0];
        const summaryParts = [
          summary.sharedAmountMinor > 0
            ? `함께 쓴 비용 ${formatMoney(summary.sharedAmountMinor, summary.currency)}`
            : null,
          summary.personalAmountMinor > 0
            ? `대신 결제한 개인 비용 ${formatMoney(summary.personalAmountMinor, summary.currency)}`
            : null,
        ].filter((part): part is string => part !== null);
        return (
          <section className="settlement-panel__currency" key={summary.currency}>
            <p className="today-section-heading__eyebrow">{summary.currency}</p>
            <strong>
              {transfer
                ? `${memberName(members, transfer.fromMemberId)} → ${memberName(members, transfer.toMemberId)} ${formatMoney(transfer.amountMinor, summary.currency)}`
                : "추가 송금이 필요하지 않아요"}
            </strong>
            <p>{transfer ? "보내면 이 통화의 여행 비용 정산이 끝납니다." : "서로 낸 금액이 이미 균형입니다."}</p>
            <p className="settlement-panel__summary">{summaryParts.join(" · ")}</p>
            <section className="settlement-panel__details">
              <h3>각자 낸 금액</h3>
              {members.map((member) => <p key={member.id}><span>{member.displayName}</span><b>{formatMoney(summary.totalsByMemberId.get(member.id) ?? 0, summary.currency)}</b></p>)}
            </section>
            <section className="settlement-panel__details">
              <h3>계산 기준</h3>
              <p><span>함께 쓴 비용</span><b>{formatMoney(summary.sharedAmountMinor, summary.currency)}</b></p>
              <p><span>대신 결제한 개인 비용</span><b>{formatMoney(summary.personalAmountMinor, summary.currency)}</b></p>
            </section>
            <button className="primary-button settlement-panel__action" disabled={!controller} onClick={() => void markSettled(summary)} type="button">
              {transfer ? "송금 완료로 표시" : "정산 완료로 표시"}
            </button>
          </section>
        );
      })}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency })
    .format(amountMinor / (10 ** fractionDigits(currency)));
}

function fractionDigits(currency: string): number {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
}

function memberName(members: PublicMember[], memberId: string): string {
  return members.find((member) => member.id === memberId)?.displayName ?? "여행자";
}
