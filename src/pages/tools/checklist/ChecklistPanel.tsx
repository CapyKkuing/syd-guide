import { useMemo, useState, type FormEvent } from "react";
import type { CheckItemView } from "../../../data/contracts";
import type { PublicMember } from "../../../shared/entities";
import type { TripMutationController } from "../../../services/mutations/controller";

type ScopeFilter = "all" | CheckItemView["scope"];

export function ChecklistPanel({
  controller,
  items,
  members,
  viewerMemberId
}: {
  controller?: TripMutationController;
  items: CheckItemView[];
  members: PublicMember[];
  viewerMemberId: string;
}) {
  const [filter, setFilter] = useState<ScopeFilter>("all");
  const [scope, setScope] = useState<CheckItemView["scope"]>("shared");
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [memo, setMemo] = useState("");
  const [assigneeMemberId, setAssigneeMemberId] = useState("");
  const [error, setError] = useState("");
  const visibleItems = useMemo(
    () => items.filter((item) => filter === "all" || item.scope === filter),
    [filter, items]
  );

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!controller) return;
    try {
      await controller.submit("check_item", "create", crypto.randomUUID(), null, {
        scope,
        ownerMemberId: scope === "personal" ? viewerMemberId : null,
        assigneeMemberId: assigneeMemberId || null,
        title: title.trim(),
        quantity: Math.max(1, Number(quantity) || 1),
        memo: memo.trim(),
        isDone: false,
        position: Math.max(0, ...items.map((item) => item.position)) + 1
      });
      setTitle("");
      setMemo("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "준비물을 추가하지 못했습니다.");
    }
  }

  async function update(item: CheckItemView, isDone: boolean) {
    if (!controller) return;
    await controller.submit("check_item", "update", item.id, item.version, {
      scope: item.scope,
      ownerMemberId: item.scope === "personal" ? viewerMemberId : null,
      assigneeMemberId: item.assigneeMemberId,
      title: item.title,
      quantity: item.quantity,
      memo: item.memo,
      isDone,
      position: item.position
    });
  }

  async function remove(item: CheckItemView) {
    if (!controller) return;
    await controller.submit("check_item", "delete", item.id, item.version, null);
  }

  return (
    <div className="tool-panel">
      <form className="tool-inline-form" onSubmit={create}>
        <label><span>준비물 범위</span><select disabled={!controller} value={scope} onChange={(event) => setScope(event.target.value as CheckItemView["scope"])}>
          <option value="shared">함께</option><option value="personal">개인</option>
        </select></label>
        <label><span>준비물</span><input disabled={!controller} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>수량</span><input disabled={!controller} min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label><span>담당자</span><select disabled={!controller} value={assigneeMemberId} onChange={(event) => setAssigneeMemberId(event.target.value)}>
          <option value="">미정</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
        </select></label>
        <label><span>메모</span><input disabled={!controller} value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
        <button className="primary-button" disabled={!controller} type="submit">추가</button>
      </form>
      <label className="tool-filter"><span>준비물 보기</span><select value={filter} onChange={(event) => setFilter(event.target.value as ScopeFilter)}>
        <option value="all">전체</option><option value="shared">함께</option><option value="personal">개인</option>
      </select></label>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="tool-entity-list">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <label><input checked={item.isDone} disabled={!controller} onChange={(event) => void update(item, event.target.checked)} type="checkbox" /><span>{item.title} × {item.quantity}</span></label>
            {controller ? <button aria-label={`${item.title} 삭제`} onClick={() => void remove(item)} type="button">삭제</button> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
