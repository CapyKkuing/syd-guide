import { useMemo, useState, type FormEvent } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import type { Expense, PublicMember } from "../../shared/entities";
import type { MutationPayloadMap } from "../../shared/mutations";
import type { TripMutationController } from "../../services/mutations/controller";

const categoryLabels: Record<Expense["category"], string> = {
  flight: "항공",
  lodging: "숙소",
  reservation: "예약",
  food: "식비",
  transport: "교통",
  shopping: "쇼핑",
  activity: "관광·활동",
  other: "기타",
};

export function ExpensePanel({
  controller,
  expenses,
  initiallyOpen = false,
  localDate,
  members,
  mode,
  viewerMemberId,
}: {
  controller?: TripMutationController;
  expenses: Expense[];
  initiallyOpen?: boolean;
  localDate: string;
  members: PublicMember[];
  mode: "before" | "during" | "after";
  viewerMemberId: string;
}) {
  const [editing, setEditing] = useState<Expense | null | undefined>(
    initiallyOpen ? null : undefined,
  );
  const [error, setError] = useState("");
  const visibleExpenses = useMemo(() => {
    if (mode === "before") return expenses.filter((expense) => expense.phase === "pretrip");
    if (mode === "during") {
      return expenses.filter((expense) =>
        expense.phase === "travel" && expense.spentOn === localDate
      );
    }
    return expenses;
  }, [expenses, localDate, mode]);

  async function toggleSettlement(expense: Expense) {
    if (!controller) return;
    setError("");
    try {
      await controller.submit("expense", "update", expense.id, expense.version, {
        phase: expense.phase,
        category: expense.category,
        title: expense.title,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        spentOn: expense.spentOn,
        paidByMemberId: expense.paidByMemberId,
        expenseScope: expense.expenseScope,
        paymentMethod: expense.paymentMethod,
        isSettled: !expense.isSettled,
        memo: expense.memo,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "정산 상태를 바꾸지 못했습니다.");
    }
  }

  const totals = totalsByCurrency(visibleExpenses);
  const title = mode === "before" ? "준비 비용" : mode === "during" ? "오늘 지출" : "전체 비용";
  const addLabel = mode === "before" ? "준비 비용 추가" : "비용 추가";

  return (
    <section className="expense-panel" aria-labelledby={`expense-panel-${mode}`}>
      <div className="expense-panel__heading">
        <div>
          <p className="today-section-heading__eyebrow">{mode === "during" ? localDate : "COST LEDGER"}</p>
          <h2 id={`expense-panel-${mode}`}>{title}</h2>
        </div>
        {mode !== "after" ? (
          <button className="primary-button" disabled={!controller} onClick={() => setEditing(null)} type="button">
            {addLabel}
          </button>
        ) : null}
      </div>
      <p className="expense-panel__totals">
        {totals.length
          ? totals.map((total) => formatMoney(total.amountMinor, total.currency)).join(" · ")
          : "아직 기록된 비용이 없습니다."}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="expense-list">
        {visibleExpenses.map((expense) => (
          <li key={expense.id}>
            <button className="expense-list__main" disabled={!controller || mode === "after"} onClick={() => setEditing(expense)} type="button">
              <span>{categoryLabels[expense.category]} · {expense.title}</span>
              <strong>{formatMoney(expense.amountMinor, expense.currency)}</strong>
              <small>
                {expense.spentOn} · {memberName(members, expense.paidByMemberId)} 결제 · {scopeLabel(expense.expenseScope)} · {paymentMethodLabel(expense.paymentMethod)}
              </small>
            </button>
            {expense.expenseScope !== "personal" ? (
              <button
                className={expense.isSettled ? "expense-settlement is-done" : "expense-settlement"}
                disabled={!controller}
                onClick={() => void toggleSettlement(expense)}
                type="button"
              >
                {expense.isSettled ? "정산 완료" : "정산 미완료"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {editing !== undefined && controller ? (
        <ExpenseEditor
          controller={controller}
          expense={editing}
          localDate={localDate}
          members={members}
          mode={mode}
          onClose={() => setEditing(undefined)}
          viewerMemberId={viewerMemberId}
        />
      ) : null}
    </section>
  );
}

function ExpenseEditor({
  controller,
  expense,
  localDate,
  members,
  mode,
  onClose,
  viewerMemberId,
}: {
  controller: TripMutationController;
  expense: Expense | null;
  localDate: string;
  members: PublicMember[];
  mode: "before" | "during" | "after";
  onClose: () => void;
  viewerMemberId: string;
}) {
  const [category, setCategory] = useState<Expense["category"]>(expense?.category ?? (mode === "before" ? "reservation" : "food"));
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? majorAmount(expense.amountMinor, expense.currency) : "");
  const [currency, setCurrency] = useState(expense?.currency ?? (mode === "before" ? "KRW" : "AUD"));
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? localDate);
  const [paidByMemberId, setPaidByMemberId] = useState(expense?.paidByMemberId ?? viewerMemberId);
  const [expenseScope, setExpenseScope] = useState<Expense["expenseScope"] | "">(expense?.expenseScope ?? "");
  const [paymentMethod, setPaymentMethod] = useState<Expense["paymentMethod"] | "">(expense?.paymentMethod ?? "");
  const [isSettled, setIsSettled] = useState(expense?.isSettled ?? false);
  const [memo, setMemo] = useState(expense?.memo ?? "");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedCurrency = currency.trim().toUpperCase();
    const amountMinor = toMinorAmount(amount, normalizedCurrency);
    if (amountMinor < 1) {
      setError("금액을 0보다 크게 입력해 주세요.");
      return;
    }
    if (!expenseScope || !paymentMethod) {
      setError("비용 구분과 결제 수단을 선택해 주세요.");
      return;
    }
    const payload: MutationPayloadMap["expense"] = {
      phase: mode === "before" ? "pretrip" : "travel",
      category,
      title: title.trim(),
      amountMinor,
      currency: normalizedCurrency,
      spentOn,
      paidByMemberId,
      expenseScope,
      paymentMethod,
      isSettled: expenseScope === "personal" ? true : isSettled,
      memo: memo.trim(),
    };
    try {
      await controller.submit(
        "expense",
        expense ? "update" : "create",
        expense?.id ?? crypto.randomUUID(),
        expense?.version ?? null,
        payload,
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "비용을 저장하지 못했습니다.");
    }
  }

  async function remove() {
    if (!expense) return;
    try {
      await controller.submit("expense", "delete", expense.id, expense.version, null);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "비용을 삭제하지 못했습니다.");
    }
  }

  return (
    <BottomSheet ariaLabel={expense ? "비용 수정" : "비용 추가"} onClose={onClose} returnFocusTo={null}>
      <form className="tool-editor" onSubmit={submit}>
        <h2>{expense ? "비용 수정" : "비용 추가"}</h2>
        <label><span>항목</span><input maxLength={160} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>분류</span><select value={category} onChange={(event) => setCategory(event.target.value as Expense["category"])}>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label><span>금액</span><input inputMode="decimal" min="0" required step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label><span>통화</span><input maxLength={3} minLength={3} pattern="[A-Za-z]{3}" required value={currency} onChange={(event) => setCurrency(event.target.value)} /></label>
        <label><span>사용일</span><input required type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} /></label>
        <label><span>결제자</span><select required value={paidByMemberId} onChange={(event) => setPaidByMemberId(event.target.value)}>
          {members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
        </select></label>
        <fieldset className="expense-editor__choice">
          <legend>비용 구분</legend>
          <label><input checked={expenseScope === "personal"} name="expense-scope" onChange={() => setExpenseScope("personal")} type="radio" />개인</label>
          <label><input checked={expenseScope === "shared"} name="expense-scope" onChange={() => setExpenseScope("shared")} type="radio" />함께</label>
        </fieldset>
        <fieldset className="expense-editor__choice">
          <legend>결제 수단</legend>
          <label><input checked={paymentMethod === "cash"} name="payment-method" onChange={() => setPaymentMethod("cash")} type="radio" />현금</label>
          <label><input checked={paymentMethod === "card"} name="payment-method" onChange={() => setPaymentMethod("card")} type="radio" />카드</label>
        </fieldset>
        <label><span>메모</span><textarea maxLength={5_000} value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
        {expenseScope !== "personal" ? <label className="tool-editor__check"><input checked={isSettled} onChange={(event) => setIsSettled(event.target.checked)} type="checkbox" />정산 완료</label> : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="tool-editor__actions">
          {expense ? <button className="danger-button" onClick={() => void remove()} type="button">삭제</button> : null}
          <button className="primary-button" type="submit">저장</button>
        </div>
      </form>
    </BottomSheet>
  );
}

function fractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("ko-KR", { style: "currency", currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

function toMinorAmount(amount: string, currency: string): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * (10 ** fractionDigits(currency)));
}

function majorAmount(amountMinor: number, currency: string): string {
  return String(amountMinor / (10 ** fractionDigits(currency)));
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
  }).format(amountMinor / (10 ** fractionDigits(currency)));
}

function totalsByCurrency(expenses: Expense[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amountMinor);
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

function memberName(members: PublicMember[], memberId: string): string {
  return members.find((member) => member.id === memberId)?.displayName ?? "여행자";
}

function scopeLabel(scope: Expense["expenseScope"]): string {
  return scope === "personal" ? "개인" : scope === "shared" ? "함께" : "구분 미입력";
}

function paymentMethodLabel(paymentMethod: Expense["paymentMethod"]): string {
  return paymentMethod === "cash" ? "현금" : paymentMethod === "card" ? "카드" : "수단 미입력";
}
