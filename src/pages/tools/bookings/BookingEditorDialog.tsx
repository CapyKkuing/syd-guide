import { useState, type FormEvent } from "react";
import { BottomSheet } from "../../../components/BottomSheet";
import type { BookingView, ScheduleItemView } from "../../../data/contracts";
import type { MutationPayloadMap } from "../../../shared/mutations";
import type { BookingDocument } from "../../../shared/media";
import type { TripMutationController } from "../../../services/mutations/controller";
import type { BookingDocumentRuntime } from "../../../services/media/bookingDocumentRuntime";
import { ocrApiClient } from "../../../services/ocr/api";
import { isSafeExternalHttpsUrl } from "../../../shared/externalUrls";

export function BookingEditorDialog({
  booking,
  controller,
  documentRuntime,
  initialBookingType,
  onClose,
  places,
  scheduleItems = [],
  timeZone,
  tripId,
}: {
  booking: BookingView | null;
  controller: TripMutationController;
  documentRuntime?: BookingDocumentRuntime;
  initialBookingType?: MutationPayloadMap["booking"]["bookingType"];
  onClose: () => void;
  places: Array<{ id: string; name: string }>;
  scheduleItems?: ScheduleItemView[];
  timeZone: string;
  tripId?: string;
}) {
  const [entityId] = useState(() => booking?.id ?? crypto.randomUUID());
  const [provider, setProvider] = useState(booking?.provider ?? "");
  const [bookingType, setBookingType] = useState<MutationPayloadMap["booking"]["bookingType"]>(booking?.bookingType ?? initialBookingType ?? "other");
  const [startsAt, setStartsAt] = useState(booking ? localDateTime(booking.startsAt) : "");
  const [endsAt, setEndsAt] = useState(booking?.endsAt ? localDateTime(booking.endsAt) : "");
  const [reservationCode, setReservationCode] = useState(booking?.reservationCode ?? "");
  const [paymentStatus, setPaymentStatus] = useState<MutationPayloadMap["booking"]["paymentStatus"]>(booking?.paymentStatus ?? "unpaid");
  const [usageStatus, setUsageStatus] = useState<MutationPayloadMap["booking"]["usageStatus"]>(booking?.usageStatus ?? "booked");
  const [placeId, setPlaceId] = useState(booking?.placeId ?? "");
  const [externalUrl, setExternalUrl] = useState(booking?.externalUrl ?? "");
  const [documentUrl, setDocumentUrl] = useState(booking?.documentUrl ?? "");
  const [memo, setMemo] = useState(booking?.memo ?? "");
  const [isFixed, setIsFixed] = useState(booking?.isFixed ?? false);
  const [isRequired, setIsRequired] = useState(booking?.isRequired ?? false);
  const linkedSchedule = scheduleItems.find((item) => item.bookingId === booking?.id);
  const [scheduleItemId, setScheduleItemId] = useState(linkedSchedule?.id ?? "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeDocument, setRemoveDocument] = useState(false);
  const [confirmation, setConfirmation] = useState<"none" | "delete" | "fixed">("none");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookingSaved, setBookingSaved] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrInfo, setOcrInfo] = useState("");
  const scheduleCandidates = rankScheduleCandidates(
    scheduleItems,
    startsAt,
    provider,
    placeId,
    linkedSchedule?.id
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    let uploadedDocument: BookingDocument | null = null;
    let documentFile = removeDocument ? null : booking?.documentFile ?? null;
    let didSaveBooking = false;
    try {
      if (selectedFile) {
        if (!documentRuntime) {
          throw new Error("Google Drive 예약 파일 기능을 사용할 수 없습니다.");
        }
        uploadedDocument = await documentRuntime.upload(selectedFile);
        documentFile = uploadedDocument;
      }
    const payload: MutationPayloadMap["booking"] = {
      placeId: placeId || null,
      bookingType,
      provider: provider.trim(),
      startsAt: zonedDateTime(startsAt, timeZone),
      endsAt: endsAt ? zonedDateTime(endsAt, timeZone) : null,
      reservationCode: reservationCode.trim() || null,
      paymentStatus,
      usageStatus,
      externalUrl: safeUrl(externalUrl),
      documentUrl: safeUrl(documentUrl),
      documentFile,
      memo: memo.trim(),
      isFixed,
      isRequired
    };
      await controller.submit(
        "booking",
        booking ? "update" : "create",
        entityId,
        booking?.version ?? null,
        payload
      );
      didSaveBooking = true;
      setBookingSaved(true);
      const previousDocument = booking?.documentFile ?? null;
      if (
        previousDocument
        && previousDocument.providerObjectId !== documentFile?.providerObjectId
        && documentRuntime
      ) {
        await documentRuntime.remove(previousDocument).catch(() => undefined);
      }
      await updateScheduleLink(entityId);
      onClose();
    } catch (caught) {
      if (!didSaveBooking && uploadedDocument && documentRuntime) {
        await documentRuntime.remove(uploadedDocument).catch(() => undefined);
      }
      setError(didSaveBooking
        ? "예약은 저장됐지만 일정 연결에 실패했습니다. 창을 닫고 예약을 다시 열어 연결해 주세요."
        : caught instanceof Error ? caught.message : "예약을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function updateScheduleLink(bookingId: string) {
    const selected = scheduleItems.find((item) => item.id === scheduleItemId);
    if (selected && selected.id !== linkedSchedule?.id) {
      await controller.submit(
        "schedule_item",
        "update",
        selected.id,
        selected.version,
        schedulePayload(selected, bookingId)
      );
    }
    if (linkedSchedule && linkedSchedule.id !== selected?.id) {
      await controller.submit(
        "schedule_item",
        "update",
        linkedSchedule.id,
        linkedSchedule.version,
        schedulePayload(linkedSchedule, null)
      );
    }
  }

  async function remove() {
    if (!booking) return;
    try {
      await controller.submit("booking", "delete", booking.id, booking.version, null);
      if (booking.documentFile && documentRuntime) {
        await documentRuntime.remove(booking.documentFile).catch(() => undefined);
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "예약을 삭제하지 못했습니다.");
    }
  }

  async function applyOcrDraft() {
    if (!selectedFile || !tripId) return;
    setOcrBusy(true);
    setError("");
    setOcrInfo("");
    try {
      const result = await ocrApiClient.bookingDraft(tripId, selectedFile);
      if (result.draft.provider) setProvider(result.draft.provider);
      if (result.draft.bookingType) setBookingType(result.draft.bookingType);
      if (result.draft.reservationCode) setReservationCode(result.draft.reservationCode);
      if (result.draft.startsAt) setStartsAt(result.draft.startsAt);
      if (result.draft.endsAt) setEndsAt(result.draft.endsAt);
      setOcrInfo(
        `자동 인식 초안을 적용했습니다. 저장 전에 확인·수정해 주세요. 이번 달 ${result.usage.used}/${result.usage.limit}페이지 사용`
      );
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "자동 인식에 실패했습니다. 직접 입력해 주세요.");
    } finally {
      setOcrBusy(false);
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
        <label>
          <span>연결할 기존 일정</span>
          <select aria-label="연결할 기존 일정" value={scheduleItemId} onChange={(event) => setScheduleItemId(event.target.value)}>
            <option value="">연결하지 않음</option>
            {scheduleCandidates.map((item) => (
              <option key={item.id} value={item.id}>{scheduleLabel(item)}</option>
            ))}
          </select>
          <small>비슷한 날짜와 장소 순서로 보여줍니다. 직접 선택할 때만 연결합니다.</small>
        </label>
        <label><span>시작 일시</span><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label><span>종료 일시</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
        <label><span>결제 상태</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as typeof paymentStatus)}>
          <option value="unpaid">미결제</option><option value="partial">일부 결제</option><option value="paid">결제 완료</option><option value="refunded">환불</option>
        </select></label>
        <label><span>이용 상태</span><select value={usageStatus} onChange={(event) => setUsageStatus(event.target.value as typeof usageStatus)}>
          <option value="booked">예약됨</option><option value="check_in_pending">체크인 전</option><option value="checked_in">체크인 완료</option>
          <option value="used">이용 완료</option><option value="cancelled">취소</option>
        </select></label>
        <label><span>예약번호</span><input value={reservationCode} onChange={(event) => setReservationCode(event.target.value)} /></label>
        <label><span>외부 주소</span><input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} /></label>
        <label><span>문서 주소</span><input type="url" value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} /></label>
        <label className="booking-document-input">
          <span>예약 사진·PDF</span>
          <input
            accept="image/jpeg,image/png,image/webp,application/pdf"
            aria-label="예약 사진·PDF"
            disabled={!documentRuntime || busy}
            onChange={(event) => {
              setSelectedFile(event.currentTarget.files?.[0] ?? null);
              setRemoveDocument(false);
            }}
            type="file"
          />
          <small>{selectedFile?.name ?? booking?.documentFile?.originalName ?? "JPG, PNG, WebP, PDF · 최대 25MB"}</small>
        </label>
        {selectedFile ? (
          <section className="booking-ocr-actions">
            <button
              className="secondary-button"
              disabled={!tripId || busy || ocrBusy}
              onClick={() => void applyOcrDraft()}
              type="button"
            >
              {ocrBusy ? "자동 인식 중…" : "OCR로 자동 입력"}
            </button>
            <small>7MB 이하 파일의 예약처·종류·일시·예약번호 초안만 채웁니다.</small>
          </section>
        ) : null}
        {booking?.documentFile && !selectedFile ? (
          <label className="tool-editor__check">
            <input checked={removeDocument} onChange={(event) => setRemoveDocument(event.target.checked)} type="checkbox" />
            저장된 예약 파일 제거
          </label>
        ) : null}
        <label><span>메모</span><textarea value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
        <label className="tool-editor__check"><input checked={isFixed} onChange={(event) => setIsFixed(event.target.checked)} type="checkbox" />고정 예약</label>
        <label className="tool-editor__check"><input checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} type="checkbox" />필수 예약</label>
        {ocrInfo ? <p aria-live="polite">{ocrInfo}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {confirmation === "delete" ? <div className="tool-editor__confirm"><p>{booking?.provider} 예약을 삭제할까요?</p><button onClick={() => booking?.isFixed ? setConfirmation("fixed") : void remove()} type="button">삭제 확인</button></div> : null}
        {confirmation === "fixed" ? <div className="tool-editor__confirm"><p>고정 예약입니다. 그래도 삭제할까요?</p><button onClick={() => void remove()} type="button">고정 예약 삭제</button></div> : null}
        <div className="tool-editor__actions">
          {booking ? <button className="danger-button" onClick={() => setConfirmation("delete")} type="button">삭제</button> : null}
          <button className="primary-button" disabled={busy || bookingSaved} type="submit">
            {bookingSaved ? "예약 저장됨" : busy ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function schedulePayload(
  item: ScheduleItemView,
  bookingId: string | null
): MutationPayloadMap["schedule_item"] {
  return {
    tripDayId: item.tripDayId,
    placeId: item.placeId,
    bookingId,
    title: item.title,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    memo: item.description,
    travelMode: item.travelMode,
    travelNote: item.travelNote ?? "",
    position: item.position,
    isFixed: item.isFixed,
    isDone: item.isDone,
  };
}

function rankScheduleCandidates(
  items: ScheduleItemView[],
  startsAt: string,
  provider: string,
  placeId: string,
  linkedId?: string
): ScheduleItemView[] {
  const targetDate = startsAt.slice(0, 10);
  const query = provider.trim().toLocaleLowerCase();
  return [...items].sort((left, right) => {
    const score = (item: ScheduleItemView) =>
      (item.id === linkedId ? 100 : 0)
      + (targetDate && item.startsAt.startsWith(targetDate) ? 30 : 0)
      + (placeId && item.placeId === placeId ? 20 : 0)
      + (query && item.title.toLocaleLowerCase().includes(query) ? 10 : 0);
    return score(right) - score(left) || left.startsAt.localeCompare(right.startsAt);
  });
}

function scheduleLabel(item: ScheduleItemView): string {
  return `${item.startsAt.slice(0, 16).replace("T", " ")} · ${item.title}`;
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
