import { useEffect, useRef } from "react";
import type { EntityKind } from "../../shared/entities";
import type { OutboxRecord } from "../offline/database";

export function ConflictDialog({
  record,
  pending = false,
  onKeepMine,
  onUseLatest
}: {
  record: OutboxRecord;
  pending?: boolean;
  onKeepMine: () => void | Promise<void>;
  onUseLatest: () => void | Promise<void>;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => titleRef.current?.focus(), []);

  const entity = entityLabel(record.mutation.entity);
  const action = actionLabel(record.mutation.action);

  return (
    <div className="conflict-dialog-backdrop">
      <section
        aria-labelledby="conflict-dialog-title"
        aria-modal="true"
        className="conflict-dialog"
        role="dialog"
      >
        <div className="conflict-dialog__heading">
          <p className="conflict-dialog__eyebrow">확인이 필요합니다</p>
          <h2 id="conflict-dialog-title" ref={titleRef} tabIndex={-1}>
            동기화 충돌
          </h2>
          <p>
            {entity} {action} 중 다른 기기의 변경을 발견했습니다.
            사용할 내용을 선택해 주세요.
          </p>
        </div>

        <div className="conflict-dialog__comparison">
          <article>
            <h3>내 수정</h3>
            <p>{safeSummary(record.mutation.entity, record.mutation.payload)}</p>
            <span>기준 버전 {record.mutation.baseVersion ?? "신규"}</span>
          </article>
          <article>
            <h3>서버 최신 내용</h3>
            <p>{safeSummary(record.mutation.entity, record.conflictCurrent)}</p>
            <span>현재 버전 {versionLabel(record.conflictCurrent)}</span>
          </article>
        </div>

        <div className="conflict-dialog__actions">
          <button
            className="secondary-button"
            disabled={pending}
            onClick={onUseLatest}
            type="button"
          >
            최신 내용 사용
          </button>
          <button
            className="primary-button"
            disabled={pending}
            onClick={onKeepMine}
            type="button"
          >
            내 수정 유지
          </button>
        </div>
      </section>
    </div>
  );
}

function entityLabel(entity: EntityKind): string {
  const labels: Record<EntityKind, string> = {
    trip_day: "여행 날짜",
    schedule_item: "일정",
    place: "장소",
    booking: "예약",
    check_item: "체크 항목",
    expense: "비용",
    note: "메모",
    vote: "투표"
  };
  return labels[entity];
}

function actionLabel(action: OutboxRecord["mutation"]["action"]): string {
  return action === "create" ? "추가"
    : action === "update" ? "수정"
      : "삭제";
}

function safeSummary(entity: EntityKind, value: unknown): string {
  if (!isRecord(value)) return "삭제 요청";
  if (entity === "trip_day") {
    return joinSummary(stringField(value, "title"), stringField(value, "dayDate"));
  }
  if (entity === "schedule_item") {
    return joinSummary(stringField(value, "title"), stringField(value, "startsAt"));
  }
  if (entity === "place") {
    return joinSummary(stringField(value, "name"), stringField(value, "status"));
  }
  if (entity === "booking") {
    return joinSummary(
      stringField(value, "provider"),
      stringField(value, "startsAt"),
      stringField(value, "paymentStatus")
    );
  }
  if (entity === "check_item") {
    return joinSummary(stringField(value, "title"), booleanField(value, "isDone"));
  }
  if (entity === "note") {
    return joinSummary(stringField(value, "visibility"), "메모 내용은 숨김");
  }
  return joinSummary(stringField(value, "choice"));
}

function versionLabel(value: unknown): string {
  return isRecord(value) && typeof value.version === "number"
    ? String(value.version)
    : "확인 불가";
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === "string" && value[key] ? value[key] : null;
}

function booleanField(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === "boolean"
    ? value[key] ? "완료" : "미완료"
    : null;
}

function joinSummary(...parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ")
    || "표시할 요약이 없습니다.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
