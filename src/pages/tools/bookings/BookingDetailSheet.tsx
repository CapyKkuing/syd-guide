import { BottomSheet } from "../../../components/BottomSheet";
import type { BookingView } from "../../../data/contracts";
import { isSafeExternalHttpsUrl } from "../../../shared/externalUrls";
import { ReservationCode } from "./ReservationCode";
import type { BookingDocumentRuntime } from "../../../services/media/bookingDocumentRuntime";
import { BookingDocumentPreview } from "./BookingDocumentPreview";

const payments = { unpaid: "미결제", partial: "일부 결제", paid: "결제 완료", refunded: "환불" };
const usages = { booked: "예약됨", check_in_pending: "체크인 전", checked_in: "체크인 완료", used: "이용 완료", cancelled: "취소" };
const bookingTypes = {
  flight: "항공", lodging: "숙소", ticket: "입장권", tour: "투어",
  transport: "교통", restaurant: "식당", other: "기타"
};

export function BookingDetailSheet({
  booking,
  placeName,
  onClose,
  onEdit,
  documentRuntime,
  returnFocusTo
}: {
  booking: BookingView;
  placeName?: string;
  onClose: () => void;
  onEdit?: () => void;
  documentRuntime?: BookingDocumentRuntime;
  returnFocusTo: HTMLElement | null;
}) {
  return (
    <BottomSheet ariaLabel="예약 상세" onClose={onClose} returnFocusTo={returnFocusTo}>
      <section className="booking-detail">
        <p className="booking-detail__type">{bookingTypes[booking.bookingType]}</p>
        <h2>{booking.provider}</h2>
        <dl>
          <div>
            <dt>예약 시간</dt>
            <dd><time>{formatDateTime(booking.startsAt)}</time>{booking.endsAt ? ` — ${formatDateTime(booking.endsAt)}` : ""}</dd>
          </div>
          <div>
            <dt>결제 상태</dt>
            <dd>{payments[booking.paymentStatus]}</dd>
          </div>
          <div>
            <dt>이용 상태</dt>
            <dd>{usages[booking.usageStatus ?? "booked"]}</dd>
          </div>
          {placeName ? <div><dt>연결 장소</dt><dd>{placeName}</dd></div> : null}
          {booking.memo ? <div><dt>메모</dt><dd>{booking.memo}</dd></div> : null}
        </dl>
        <ReservationCode value={booking.reservationCode} />
        {booking.documentFile ? (
          <BookingDocumentPreview
            document={booking.documentFile}
            runtime={documentRuntime}
          />
        ) : null}
        <section className="booking-detail__actions">
          {isSafeExternalHttpsUrl(booking.externalUrl) ? <a href={booking.externalUrl} rel="noreferrer noopener" target="_blank">예약 페이지 열기</a> : null}
          {isSafeExternalHttpsUrl(booking.documentUrl) ? <a className="booking-detail__document" href={booking.documentUrl} rel="noreferrer noopener" target="_blank">바우처 문서 열기</a> : null}
          {onEdit ? <button onClick={onEdit} type="button">예약 수정</button> : null}
        </section>
      </section>
    </BottomSheet>
  );
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}
