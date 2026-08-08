import { useMemo, useState, type FormEvent } from "react";
import { Button, HStack, Text, VStack } from "@astryxdesign/core";
import type { CheckItemView } from "../../../data/contracts";
import type { PublicMember } from "../../../shared/entities";
import type { TripMutationController } from "../../../services/mutations/controller";

type ScopeFilter = "all" | CheckItemView["scope"];

const categorySections = [
  { id: "essential", title: "필수 준비", description: "여권, 보험, 입국 준비를 확인하세요." },
  { id: "reservation", title: "예약·바우처", description: "항공, 숙소, 이용권 정보를 모아두세요." },
  { id: "packing", title: "개인 짐", description: "통신과 개인 준비물을 챙기세요." },
  { id: "travel", title: "여행 중", description: "현지에서 처리할 일을 정리하세요." }
] as const;

export function ChecklistPanel({
  controller,
  initialAction,
  items,
  members,
  viewerMemberId
}: {
  controller?: TripMutationController;
  initialAction?: "edit-passport";
  items: CheckItemView[];
  members: PublicMember[];
  viewerMemberId: string;
}) {
  const initialPassport = initialAction === "edit-passport"
    ? items.find((item) => (
      item.requirementKind === "passport"
      && (item.ownerMemberId === viewerMemberId || item.assigneeMemberId === viewerMemberId)
    ))
    : undefined;
  const [filter, setFilter] = useState<ScopeFilter>("all");
  const [editingItem, setEditingItem] = useState<CheckItemView | null>(initialPassport ?? null);
  const [category, setCategory] = useState<CheckItemView["category"]>(initialPassport?.category ?? "essential");
  const [scope, setScope] = useState<CheckItemView["scope"]>(initialPassport?.scope ?? (initialAction === "edit-passport" ? "personal" : "shared"));
  const [title, setTitle] = useState(initialPassport?.title ?? (initialAction === "edit-passport" ? "여권" : ""));
  const [quantity, setQuantity] = useState(String(initialPassport?.quantity ?? 1));
  const [memo, setMemo] = useState(initialPassport?.memo ?? "");
  const [requirementKind, setRequirementKind] = useState<CheckItemView["requirementKind"]>(initialPassport?.requirementKind ?? (initialAction === "edit-passport" ? "passport" : null));
  const [assigneeMemberId, setAssigneeMemberId] = useState(initialPassport?.assigneeMemberId ?? (initialAction === "edit-passport" ? viewerMemberId : ""));
  const [error, setError] = useState("");
  const visibleItems = useMemo(
    () => items.filter((item) => filter === "all" || item.scope === filter),
    [filter, items]
  );
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName])),
    [members]
  );
  const doneCount = items.filter((item) => item.isDone).length;
  const essentialItems = items.filter((item) => item.category === "essential");
  const reservationItems = items.filter((item) => item.category === "reservation");

  function clearEditor() {
    setEditingItem(null);
    setCategory("essential");
    setScope("shared");
    setTitle("");
    setQuantity("1");
    setMemo("");
    setRequirementKind(null);
    setAssigneeMemberId("");
  }

  function edit(item: CheckItemView) {
    setEditingItem(item);
    setCategory(item.category);
    setScope(item.scope);
    setTitle(item.title);
    setQuantity(String(item.quantity));
    setMemo(item.memo);
    setRequirementKind(item.requirementKind);
    setAssigneeMemberId(item.assigneeMemberId ?? "");
    document.querySelector<HTMLDetailsElement>(".checklist-add-panel")?.setAttribute("open", "");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!controller) return;
    try {
      await controller.submit("check_item", editingItem ? "update" : "create", editingItem?.id ?? crypto.randomUUID(), editingItem?.version ?? null, {
        phase: category === "travel" ? "travel" : "pretrip",
        category,
        scope,
        ownerMemberId: scope === "personal" ? editingItem?.ownerMemberId ?? viewerMemberId : null,
        assigneeMemberId: assigneeMemberId || null,
        title: title.trim(),
        quantity: Math.max(1, Number(quantity) || 1),
        memo: memo.trim(),
        requirementKind,
        isDone: editingItem?.isDone ?? false,
        position: editingItem?.position ?? Math.max(0, ...items.map((item) => item.position)) + 1
      });
      clearEditor();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "준비물을 추가하지 못했습니다.");
    }
  }

  async function toggle(item: CheckItemView, isDone: boolean) {
    if (!controller) return;
    await controller.submit("check_item", "update", item.id, item.version, {
      phase: item.phase,
      category: item.category,
      scope: item.scope,
      ownerMemberId: item.scope === "personal" ? viewerMemberId : null,
      assigneeMemberId: item.assigneeMemberId,
      title: item.title,
      quantity: item.quantity,
      memo: item.memo,
      requirementKind: item.requirementKind,
      isDone,
      position: item.position
    });
  }

  async function remove(item: CheckItemView) {
    if (!controller) return;
    await controller.submit("check_item", "delete", item.id, item.version, null);
  }

  return (
    <VStack className="checklist-panel" gap={4}>
      <VStack className="checklist-summary" gap={2}>
        <HStack className="checklist-summary__heading" gap={2}>
          <VStack gap={1}>
            <Text className="checklist-summary__eyebrow" type="label">준비 현황</Text>
            <Text type="body">완료 {doneCount} / 전체 {items.length}</Text>
          </VStack>
          <Text className="checklist-progress" type="label">{items.length ? Math.round(doneCount / items.length * 100) : 0}%</Text>
        </HStack>
        <HStack className="checklist-statuses" gap={2}>
          <Text className="checklist-status" type="label">필수 {statusCopy(essentialItems)}</Text>
          <Text className="checklist-status" type="label">예약 {statusCopy(reservationItems)}</Text>
        </HStack>
      </VStack>

      <label className="tool-filter checklist-filter"><span>누구의 항목을 볼까요?</span><select value={filter} onChange={(event) => setFilter(event.target.value as ScopeFilter)}>
        <option value="all">전체</option><option value="shared">함께</option><option value="personal">개인</option>
      </select></label>
      {error ? <p role="alert">{error}</p> : null}

      <VStack className="checklist-groups" gap={4}>
        {categorySections.map((section) => {
          const sectionItems = visibleItems.filter((item) => item.category === section.id);
          const sectionDone = sectionItems.filter((item) => item.isDone).length;
          return (
            <section className="checklist-section" key={section.id} aria-labelledby={`checklist-${section.id}`}>
              <HStack className="checklist-section__heading" gap={2}>
                <VStack gap={1}>
                  <h4 id={`checklist-${section.id}`}>{section.title}</h4>
                  <p>{section.description}</p>
                </VStack>
                <Text className="checklist-section__count" type="label">{sectionDone}/{sectionItems.length}</Text>
              </HStack>
              {sectionItems.length ? (
                <ul className="checklist-list">
                  {sectionItems.map((item) => (
                    <li className={item.isDone ? "is-done" : undefined} key={item.id}>
                      <label className="checklist-item__check">
                        <input checked={item.isDone} disabled={!controller} onChange={(event) => void toggle(item, event.target.checked)} type="checkbox" />
                        <VStack gap={1}>
                          <span className="checklist-item__title">{item.title} × {item.quantity}</span>
                          <span className="checklist-item__meta">{item.scope === "shared" ? "함께" : "개인"}{item.assigneeMemberId ? ` · ${memberNames.get(item.assigneeMemberId) ?? "담당자"}` : ""}</span>
                        </VStack>
                      </label>
                      {controller ? (
                        <HStack gap={1}>
                          <Button label={`${item.title} 편집`} onClick={() => edit(item)} size="sm" variant="ghost">편집</Button>
                          <Button label={`${item.title} 삭제`} onClick={() => void remove(item)} size="sm" variant="ghost">삭제</Button>
                        </HStack>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : <Text className="checklist-section__empty" type="body">아직 등록된 항목이 없어요.</Text>}
            </section>
          );
        })}
      </VStack>

      <details className="checklist-add-panel" open={initialAction === "edit-passport" || undefined}>
        <summary>{editingItem ? "체크 항목 편집" : "새 체크 항목 추가"}</summary>
        <form className="tool-inline-form checklist-form" onSubmit={save}>
          <label><span>카테고리</span><select disabled={!controller} value={category} onChange={(event) => setCategory(event.target.value as CheckItemView["category"])}>
            <option value="essential">필수 준비</option><option value="reservation">예약·바우처</option><option value="packing">개인 짐</option><option value="travel">여행 중</option>
          </select></label>
          <label><span>준비물 범위</span><select disabled={!controller} value={scope} onChange={(event) => setScope(event.target.value as CheckItemView["scope"])}>
            <option value="shared">함께</option><option value="personal">개인</option>
          </select></label>
          <label><span>준비물</span><input disabled={!controller} required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label><span>수량</span><input disabled={!controller} min="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
          <label><span>담당자</span><select disabled={!controller} value={assigneeMemberId} onChange={(event) => setAssigneeMemberId(event.target.value)}>
            <option value="">미정</option>{members.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
          </select></label>
          <label><span>필수 준비 구분</span><select disabled={!controller} value={requirementKind ?? ""} onChange={(event) => setRequirementKind(event.target.value ? event.target.value as NonNullable<CheckItemView["requirementKind"]> : null)}>
            <option value="">일반</option><option value="passport">여권</option><option value="essential">필수 준비물</option>
          </select></label>
          <label className="checklist-form__memo"><span>메모</span><input disabled={!controller} value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
          <HStack gap={2}>
            <Button isDisabled={!controller} label={editingItem ? "체크 항목 저장" : "체크 항목 추가"} type="submit" variant="primary" />
            {editingItem ? <Button label="편집 취소" onClick={clearEditor} variant="secondary">취소</Button> : null}
          </HStack>
        </form>
      </details>
    </VStack>
  );
}

function statusCopy(items: CheckItemView[]): string {
  if (!items.length) return "미등록";
  return `${items.filter((item) => item.isDone).length}/${items.length}`;
}
