import { useState, type FormEvent } from "react";
import { BottomSheet } from "../../../components/BottomSheet";
import type { BookingView } from "../../../data/contracts";
import type { MutationPayloadMap } from "../../../shared/mutations";
import type { TripMutationController } from "../../../services/mutations/controller";
import { isSafeExternalHttpsUrl } from "../../../shared/externalUrls";

export function BookingEditorDialog({
  booking,
  controller,
  onClose,
  places,
  timeZone
}: {
  booking: BookingView | null;
  controller: TripMutationController;
  onClose: () => void;
  places: Array<{ id: string; name: string }>;
  timeZone: string;
}) {
  const [provider, setProvider] = useState(booking?.provider ?? "");
  const [bookingType, setBookingType] = useState<MutationPayloadMap["booking"]["bookingType"]>(booking?.bookingType ?? "other");
  const [startsAt, setStartsAt] = useState(booking ? localDateTime(booking.startsAt) : "");
  const [endsAt, setEndsAt] = useState(booking?.endsAt ? localDateTime(booking.endsAt) : "");
  const [reservationCode, setReservationCode] = useState(booking?.reservationCode ?? "");
  const [paymentStatus, setPaymentStatus] = useState<MutationPayloadMap["booking"]["paymentStatus"]>(booking?.paymentStatus ?? "unpaid");
  const [placeId, setPlaceId] = useState(booking?.placeId ?? "");
  const [externalUrl, setExternalUrl] = useState(booking?.externalUrl ?? "");
  const [documentUrl, setDocumentUrl] = useState(booking?.documentUrl ?? "");
  const [memo, setMemo] = useState(booking?.memo ?? "");
  const [isFixed, setIsFixed] = useState(booking?.isFixed ?? false);
  const [isRequired, setIsRequired] = useState(booking?.isRequired ?? false);
  const [confirmation, setConfirmation] = useState<"none" | "delete" | "fixed">("none");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload: MutationPayloadMap["booking"] = {
      placeId: placeId || null,
      bookingType,
      provider: provider.trim(),
      startsAt: zonedDateTime(startsAt, timeZone),
      endsAt: endsAt ? zonedDateTime(endsAt, timeZone) : null,
      reservationCode: reservationCode.trim() || null,
      paymentStatus,
      externalUrl: safeUrl(externalUrl),
      documentUrl: safeUrl(documentUrl),
      memo: memo.trim(),
      isFixed,
      isRequired
    };
    try {
      await controller.submit("booking", booking ? "update" : "create", booking?.id ?? crypto.randomUUID(), booking?.version ?? null, payload);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "예약을 저장하지 못했습니다.");
    }
  }

  async function remove() {
    if (!booking) return;
    try {
      await controller.submit("booking", "delete", booking.id, booking.version, null);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "예약을 삭제하지 못했습니다.");
    }
  }

  return (
    <BottomSheet ariaLabel={booking ? "예약 수정" : "예약 추가"} onClose={onClose} returnFocusTo={null}>
      <form className="tool-editor" onSubmit={submit}>
        <h2>{booking ? "예약 수정" : "예약 추가"}</h2>
        <label><span>예약처</span><input required value={provider} onChange={(event) => setProvider(event.target.value)} /></label>
        <label><span>예약 종류</span><select value={bookingType} onChange={(event) => setBookingType(event.target.value as typeof bookingType)}>
          <option value="flight">항공</option><option value="lodging">숙소</option><option value="ticket">티켓</option>
          <option value="tour">투어</option><option value="transport">교통</option><option value="restaurant">식당</option><option value="other">기타</option>
        </select></label>
        <label><span>연결 장소</span><select value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
          <option value="">없음</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select></label>
        <label><span>시작 일시</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label><span>종료 일시</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
        <label><span>결제 상태</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as typeof paymentStatus)}>
          <option value="unpaid">미결제</option><option value="partial">일부 결제</option><option value="paid">결제 완료</option><option value="refunded">환불</option>
        </select></label>
        <label><span>예약번호</span><input value={reservationCode} onChange={(event) => setReservationCode(event.target.value)} /></label>
        <label><span>외부 주소</span><input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} /></label>
        <label><span>문서 주소</span><input type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} /></label>
        <label><span>메모</span><textarea value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
        <label className="tool-editor__check"><input checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)} type="checkbox" />고정 예약</label>
        <label className="tool-editor__check"><input checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} type="checkbox" />필수 예약</label>
        {error ? <p role="alert">{error}</p> : null}
        {confirmation === "delete" ? <div className="tool-editor__confirm"><p>{booking?.provider} 예약을 삭제할까요?</p><button onClick={() => booking?.isFixed ? setConfirmation("fixed") : void remove()} type="button">삭제 확인</button></div> : null}
        {confirmation === "fixed" ? <div className="tool-editor__confirm"><p>고정 예약입니다. 그래도 삭제할까요?</p><button onClick={() => void remove()} type="button">고정 예약 삭제</button></div> : null}
        <div className="tool-editor__actions">
          {booking ? <button className="danger-button" onClick={() => setConfirmation("delete")} type="button">삭제</button> : null}
          <button className="primary-button" type="submit">저장</button>
        </div>
      </form>
    </BottomSheet>
  );
}

function localDateTime(value: string): string {
  return value.slice(0, 16);
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  return isSafeExternalHttpsUrl(trimmed) ? trimmed : null;
}

function zonedDateTime(value: string, timeZone: string): string {
  const [date = "", time = ""] = value.split("T");
  const guess = Date.parse(`${date}T${time}:00Z`);
  const firstOffset = offsetMinutes(new Date(guess), timeZone);
  const instant = new Date(guess - firstOffset * 60_000);
  return `${date}T${time}:00${formatOffset(offsetMinutes(instant, timeZone))}`;
}

function offsetMinutes(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  if (!name || name === "GMT") return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name);
  if (!match) throw new Error("여행 시간대를 적용하지 못했습니다.");
  return (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]));
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
