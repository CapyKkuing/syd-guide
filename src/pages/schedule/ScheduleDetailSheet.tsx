import { BottomSheet } from "../../components/BottomSheet";
import type { ScheduleItemView } from "../../data/contracts";
import { isSafeExternalHttpsUrl } from "../../shared/externalUrls";

export interface ScheduleDetailSheetProps {
  item: ScheduleItemView;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
  onEdit?: () => void;
}

const kindLabels: Record<ScheduleItemView["kind"], string> = {
  movement: "이동",
  meal: "식사",
  attraction: "관광",
  booking: "예약",
  note: "메모"
};

const modeLabels: Record<NonNullable<ScheduleItemView["travelMode"]>, string> = {
  walk: "도보",
  transit: "대중교통",
  drive: "차량",
  ferry: "페리"
};

function timeOf(value: string): string {
  return value.slice(11, 16);
}

function timeRange(item: ScheduleItemView): string {
  return item.endsAt ? `${timeOf(item.startsAt)} — ${timeOf(item.endsAt)}` : `${timeOf(item.startsAt)} 이후`;
}

function movementDetail(item: ScheduleItemView): string {
  const mode = item.travelMode ? modeLabels[item.travelMode] : null;
  return [mode, item.travelNote].filter(Boolean).join(" · ") || "이동 정보 없음";
}

function bookingDetail(item: ScheduleItemView): string {
  const provider = item.bookingProvider ? `${item.bookingProvider} · ` : "";
  if (item.bookingStatus === "confirmed") return `${provider}예약 확정`;
  if (item.bookingStatus === "pending") return `${provider}예약 확인 필요`;
  return "예약 정보 없음";
}

export function ScheduleDetailSheet({ item, onClose, onEdit, returnFocusTo }: ScheduleDetailSheetProps) {
  return (
    <BottomSheet ariaLabel="일정 상세" onClose={onClose} returnFocusTo={returnFocusTo}>
      <div className="schedule-detail">
        <p className="schedule-detail__time"><time>{timeRange(item)}</time></p>
        <h2>{item.title}</h2>
        <dl>
          <div>
            <dt>장소</dt>
            <dd>{item.place}</dd>
          </div>
          <div>
            <dt>분류</dt>
            <dd>{kindLabels[item.kind]}</dd>
          </div>
          <div>
            <dt>설명</dt>
            <dd>{item.description}</dd>
          </div>
          <div>
            <dt>이동 정보</dt>
            <dd>{movementDetail(item)}</dd>
          </div>
          <div>
            <dt>예약 상태</dt>
            <dd>{bookingDetail(item)}</dd>
          </div>
        </dl>
        {isSafeExternalHttpsUrl(item.mapUrl) ? (
          <a className="schedule-detail__map-link" href={item.mapUrl} rel="noreferrer noopener" target="_blank">
            지도에서 열기
          </a>
        ) : null}
        {onEdit ? (
          <button className="secondary-button" onClick={onEdit} type="button">
            일정 수정
          </button>
        ) : null}
      </div>
    </BottomSheet>
  );
}
