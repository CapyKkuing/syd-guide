import { useState, type FormEvent } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import type { MapPlaceView, ScheduleDayView, ScheduleItemView } from "../../data/contracts";
import type {
  MutationPayloadMap
} from "../../shared/mutations";
import type { TripMutationController } from "../../services/mutations/controller";

export function ScheduleEditorDialog({
  day,
  item,
  mutationController,
  onClose,
  places,
  timeZone
}: {
  day: ScheduleDayView;
  item: ScheduleItemView | null;
  mutationController: TripMutationController;
  onClose: () => void;
  places: MapPlaceView[];
  timeZone: string;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [startTime, setStartTime] = useState(item ? timeOf(item.startsAt) : "");
  const [endTime, setEndTime] = useState(item?.endsAt ? timeOf(item.endsAt) : "");
  const [memo, setMemo] = useState(item?.description ?? "");
  const [placeId, setPlaceId] = useState(item?.placeId ?? "");
  const [travelMode, setTravelMode] = useState<
    "" | "walk" | "transit" | "drive" | "ferry"
  >(item?.travelMode ?? "");
  const [isFixed, setIsFixed] = useState(item?.isFixed ?? false);
  const [isDone, setIsDone] = useState(item?.isDone ?? false);
  const [confirmation, setConfirmation] = useState<"none" | "delete" | "fixed">("none");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload: MutationPayloadMap["schedule_item"] = {
        tripDayId: day.id,
        placeId: placeId || null,
        bookingId: item?.bookingId ?? null,
        title: title.trim(),
        startsAt: zonedIso(day.date, startTime, timeZone),
        endsAt: endTime ? zonedIso(day.date, endTime, timeZone) : null,
        memo: memo.trim(),
        travelMode: travelMode || null,
        travelNote: item?.travelNote ?? "",
        position: item?.position ?? nextPosition(day),
        isFixed,
        isDone
      };
      await mutationController.submit(
        "schedule_item",
        item ? "update" : "create",
        item?.id ?? crypto.randomUUID(),
        item?.version ?? null,
        payload
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "일정을 저장하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!item) return;
    setError("");
    setSubmitting(true);
    try {
      await mutationController.submit(
        "schedule_item",
        "delete",
        item.id,
        item.version,
        null
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "일정을 삭제하지 못했습니다.");
      setConfirmation("none");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      ariaLabel={item ? "일정 수정" : "일정 추가"}
      onClose={onClose}
      returnFocusTo={null}
    >
      <form className="schedule-editor" onSubmit={submit}>
        <h2>{item ? "일정 수정" : "일정 추가"}</h2>
        <label>
          <span>일정 제목</span>
          <input
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        <div className="schedule-editor__times">
          <label>
            <span>시작 시간</span>
            <input
              onChange={(event) => setStartTime(event.target.value)}
              required
              type="time"
              value={startTime}
            />
          </label>
          <label>
            <span>종료 시간</span>
            <input
              onChange={(event) => setEndTime(event.target.value)}
              type="time"
              value={endTime}
            />
          </label>
        </div>
        <label>
          <span>연결 장소</span>
          <select onChange={(event) => setPlaceId(event.target.value)} value={placeId}>
            <option value="">연결 안 함</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>{place.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>메모</span>
          <textarea
            maxLength={1_000}
            onChange={(event) => setMemo(event.target.value)}
            value={memo}
          />
        </label>
        <label>
          <span>이동 수단</span>
          <select
            onChange={(event) => setTravelMode(
              event.target.value as "" | "walk" | "transit" | "drive" | "ferry"
            )}
            value={travelMode}
          >
            <option value="">없음</option>
            <option value="walk">도보</option>
            <option value="transit">대중교통</option>
            <option value="drive">차량</option>
            <option value="ferry">페리</option>
          </select>
        </label>
        <div className="schedule-editor__checks">
          <label><input checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)} type="checkbox" />고정 일정</label>
          <label><input checked={isDone} onChange={(event) => setIsDone(event.target.checked)} type="checkbox" />완료</label>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        {confirmation === "delete" ? (
          <div className="schedule-editor__confirm">
            <p>{item?.title} 일정을 삭제할까요?</p>
            <button
              onClick={() => {
                if (item?.isFixed) setConfirmation("fixed");
                else void remove();
              }}
              type="button"
            >
              삭제 확인
            </button>
          </div>
        ) : null}
        {confirmation === "fixed" ? (
          <div className="schedule-editor__confirm">
            <p>고정 일정입니다. 그래도 삭제할까요?</p>
            <button onClick={remove} type="button">고정 일정 삭제</button>
          </div>
        ) : null}
        <div className="schedule-editor__actions">
          {item ? (
            <button
              className="danger-button"
              disabled={submitting}
              onClick={() => setConfirmation("delete")}
              type="button"
            >
              삭제
            </button>
          ) : null}
          <button className="primary-button" disabled={submitting} type="submit">
            저장
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function nextPosition(day: ScheduleDayView): number {
  return Math.max(0, ...day.items.map((item) => item.position)) + 1;
}

function timeOf(value: string): string {
  return value.slice(11, 16);
}

function zonedIso(date: string, time: string, timeZone: string): string {
  const guess = Date.parse(`${date}T${time}:00Z`);
  const firstOffset = offsetMinutes(new Date(guess), timeZone);
  const instant = new Date(guess - firstOffset * 60_000);
  return `${date}T${time}:00${formatOffset(offsetMinutes(instant, timeZone))}`;
}

function offsetMinutes(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset"
  }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  if (!name || name === "GMT") return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name);
  if (!match) throw new Error("여행 시간대를 적용하지 못했습니다.");
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return (match[1] === "+" ? 1 : -1) * (hours * 60 + minutes);
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
