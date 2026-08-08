import { useMemo, useState } from "react";
import type { Expense, PublicMember, SettlementTransfer } from "../../shared/entities";
import type { TripMutationController } from "../../services/mutations/controller";
import { calculateSettlements, type SettlementCurrency } from "./settlement";

export function SettlementPanel({
  controller,
  expenses,
  members,
  transfers,
}: {
  controller?: TripMutationController;
  expenses: Expense[];
  members: PublicMember[];
  transfers: SettlementTransfer[];
}) {
  const [resolvedExpenseIds, setResolvedExpenseIds] = useState<string[]>([]);
  const [optimisticTransfers, setOptimisticTransfers] = useState<Record<string, SettlementTransfer>>({});
  const [error, setError] = useState("");
  const displayTransfers = useMemo(
    () => {
      const serverIds = new Set(transfers.map((transfer) => transfer.id));
      const optimistic = Object.values(optimisticTransfers)
        .filter((transfer) => !serverIds.has(transfer.id));
      return [
        ...transfers.map((transfer) => {
          const optimistic = optimisticTransfers[transfer.id];
          return optimistic && optimistic.version > transfer.version ? optimistic : transfer;
        }),
        ...optimistic,
      ];
    },
    [optimisticTransfers, transfers],
  );
  const activeExpenseIds = useMemo(() => new Set(
    displayTransfers.filter((transfer) => transfer.status === "pending")
      .flatMap((transfer) => transfer.expenseIds)
  ), [displayTransfers]);
  const settlements = useMemo(() => calculateSettlements(
    expenses.filter((expense) => !resolvedExpenseIds.includes(expense.id) && !activeExpenseIds.has(expense.id)),
    members,
  ), [activeExpenseIds, expenses, members, resolvedExpenseIds]);
  const transferGroups = useMemo(() => {
    const groups = new Map<string, SettlementTransfer[]>();
    displayTransfers.forEach((transfer) => groups.set(
      transfer.settlementGroupId,
      [...(groups.get(transfer.settlementGroupId) ?? []), transfer],
    ));
    return [...groups.values()].filter((group) => group.some((transfer) => transfer.status === "pending"));
  }, [displayTransfers]);

  async function createSettlement(summary: SettlementCurrency) {
    if (!controller?.createSettlementGroup) return;
    setError("");
    try {
      const result = await controller.createSettlementGroup(
        summary.expenseIds,
        summary.currency,
        summary.transfers,
      );
      const created = result.transfers.map((stored, index) => {
        const transfer = summary.transfers[index];
        if (!transfer) throw new Error("정산 송금 결과 수가 올바르지 않습니다.");
        return {
        ...transfer,
        id: stored.entityId,
        tripId: "pending",
        version: stored.version,
        updatedAt: new Date().toISOString(),
        updatedBy: "pending",
        settlementGroupId: result.entityId,
        expenseIds: summary.expenseIds,
        currency: summary.currency,
        status: "pending" as const,
        completedAt: null,
      };
      });
      setOptimisticTransfers((current) => Object.fromEntries([
        ...Object.entries(current), ...created.map((transfer) => [transfer.id, transfer]),
      ]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "정산 송금을 만들지 못했습니다.");
    }
  }

  async function completeTransfer(transfer: SettlementTransfer, group: SettlementTransfer[]) {
    if (!controller?.completeSettlementTransfer) return;
    setError("");
    const completedAt = new Date().toISOString();
    try {
      const result = await controller.completeSettlementTransfer(
        transfer.id,
        transfer.version,
        transfer.settlementGroupId
      );
      const completed = { ...transfer, status: "completed" as const, completedAt, version: result.version };
      setOptimisticTransfers((current) => ({ ...current, [transfer.id]: completed }));
      if (group.every((item) => item.id === transfer.id || item.status === "completed")) {
        setResolvedExpenseIds((ids) => [...ids, ...transfer.expenseIds]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "송금 완료 상태를 저장하지 못했습니다.");
    }
  }

  if (!settlements.length && !transferGroups.length) return null;

  return (
    <section className="settlement-panel" aria-labelledby="settlement-title">
      <p className="today-section-heading__eyebrow">SETTLEMENT</p>
      <h2 id="settlement-title">정산하기</h2>
      <p className="settlement-panel__intro">함께 쓴 비용과 대신 결제한 개인 비용만 계산했어요.</p>
      {transferGroups.map((group) => (
        <section className="settlement-panel__currency" key={group[0]?.settlementGroupId}>
          <p className="today-section-heading__eyebrow">진행 중인 정산</p>
          {group.map((transfer) => (
            <p className="settlement-panel__transfer" key={transfer.id}>
              <span>{memberName(members, transfer.fromMemberId)} → {memberName(members, transfer.toMemberId)}</span>
              <b>{formatMoney(transfer.amountMinor, transfer.currency)}</b>
              <button
                className="primary-button"
                disabled={
                  !controller?.completeSettlementTransfer
                  || transfer.status === "completed"
                }
                onClick={() => void completeTransfer(transfer, group)}
                type="button"
              >
                {transfer.status === "completed" ? "송금 완료됨" : "송금 완료"}
              </button>
            </p>
          ))}
        </section>
      ))}
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
            <strong>{transfer ? `${summary.transfers.length}건의 송금이 필요해요` : "추가 송금이 필요하지 않아요"}</strong>
            <p>{transfer ? "송금별로 완료를 표시할 수 있습니다." : "서로 낸 금액이 이미 균형입니다."}</p>
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
            <button className="primary-button settlement-panel__action" disabled={!controller?.createSettlementGroup || !transfer} onClick={() => void createSettlement(summary)} type="button">
              {transfer ? "정산 송금 만들기" : "정산 완료"}
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
