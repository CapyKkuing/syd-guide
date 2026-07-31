import { useState } from "react";
import { Button, HStack, Text, VStack } from "@astryxdesign/core";
import type { BookingView } from "../../../data/contracts";
import type { TripMutationController } from "../../../services/mutations/controller";
import { isSafeExternalHttpsUrl } from "../../../shared/externalUrls";
import { BookingEditorDialog } from "./BookingEditorDialog";
import { ReservationCode } from "./ReservationCode";

const payments = { unpaid: "미결제", partial: "일부 결제", paid: "결제 완료", refunded: "환불" };
const bookingTypes = {
  flight: "항공", lodging: "숙소", ticket: "입장권", tour: "투어",
  transport: "교통", restaurant: "식당", other: "기타"
};

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
    <VStack className="bookings-panel" gap={3}>
      <HStack className="bookings-panel__intro" gap={3}>
        <VStack gap={1}>
          <Text className="bookings-panel__eyebrow" type="label">예약 보관함 · {bookings.length}개</Text>
          <Text type="body">항공권, 숙소, 이용권을 한곳에서 확인하세요.</Text>
        </VStack>
        <Button isDisabled={!controller} label="예약 추가" onClick={() => setEditing(null)} variant="primary" />
      </HStack>
      <ul className="booking-list">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <article className="booking-card">
              <HStack className="booking-card__heading" gap={2}>
                <VStack gap={1}>
                  <h4>{booking.provider}</h4>
                  <p><time>{formatDateTime(booking.startsAt)}</time> · {payments[booking.paymentStatus]}</p>
                </VStack>
                <Text className="booking-card__type" type="label">{bookingTypes[booking.bookingType]}</Text>
              </HStack>
              <ReservationCode value={booking.reservationCode} />
              <HStack className="booking-card__actions" gap={2}>
                {isSafeExternalHttpsUrl(booking.externalUrl) ? <a href={booking.externalUrl} rel="noreferrer noopener" target="_blank">예약 열기</a> : null}
                {isSafeExternalHttpsUrl(booking.documentUrl) ? <a href={booking.documentUrl} rel="noreferrer noopener" target="_blank">문서 열기</a> : null}
                {controller ? <Button label="수정" onClick={() => setEditing(booking)} size="sm" variant="secondary" /> : null}
              </HStack>
            </article>
          </li>
        ))}
      </ul>
      {bookings.length === 0 ? (
        <VStack className="booking-empty-state" gap={1}>
          <Text type="label">아직 보관한 예약이 없어요.</Text>
          <Text type="body">미리 예약한 항공권, 호텔, 이용권을 추가해 두세요.</Text>
        </VStack>
      ) : null}
      {editing !== undefined && controller ? <BookingEditorDialog booking={editing} controller={controller} onClose={() => setEditing(undefined)} places={places} timeZone={timeZone} /> : null}
    </VStack>
  );
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}
