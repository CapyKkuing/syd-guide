import { useState } from "react";
import type { BookingView } from "../../../data/contracts";
import type { TripMutationController } from "../../../services/mutations/controller";
import { isSafeExternalHttpsUrl } from "../../../shared/externalUrls";
import { BookingEditorDialog } from "./BookingEditorDialog";
import { ReservationCode } from "./ReservationCode";

const payments = { unpaid: "미결제", partial: "일부 결제", paid: "결제 완료", refunded: "환불" };

export function BookingsPanel({
  bookings,
  controller,
  places,
  timeZone
}: {
  bookings: BookingView[];
  controller?: TripMutationController;
  places: Array<{ id: string; name: string }>;
  timeZone: string;
}) {
  const [editing, setEditing] = useState<BookingView | null | undefined>();
  return (
    <div className="tool-panel">
      <button className="primary-button" disabled={!controller} onClick={() => setEditing(null)} type="button">예약 추가</button>
      <ul className="tool-entity-list">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <article>
              <h4>{booking.provider}</h4>
              <p><time>{formatDateTime(booking.startsAt)}</time> · {payments[booking.paymentStatus]}</p>
              <ReservationCode value={booking.reservationCode} />
              <div className="tool-link-row">
                {isSafeExternalHttpsUrl(booking.externalUrl) ? <a href={booking.externalUrl} rel="noreferrer noopener" target="_blank">예약 열기</a> : null}
                {isSafeExternalHttpsUrl(booking.documentUrl) ? <a href={booking.documentUrl} rel="noreferrer noopener" target="_blank">문서 열기</a> : null}
              </div>
              {controller ? <button className="secondary-button" onClick={() => setEditing(booking)} type="button">수정</button> : null}
            </article>
          </li>
        ))}
      </ul>
      {bookings.length === 0 ? <p>등록된 예약이 없습니다.</p> : null}
      {editing !== undefined && controller ? <BookingEditorDialog booking={editing} controller={controller} onClose={() => setEditing(undefined)} places={places} timeZone={timeZone} /> : null}
    </div>
  );
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}
