import { useState } from "react";
import { Button, HStack, Icon, Text, VStack } from "@astryxdesign/core";
import type { BookingView } from "../../../data/contracts";
import type { ExperiencePhase } from "../../../domain/tripPhase";
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
  timeZone,
  experiencePhase = "before",
  localDate
}: {
  bookings: BookingView[];
  controller?: TripMutationController;
  places: Array<{ id: string; name: string }>;
  timeZone: string;
  experiencePhase?: ExperiencePhase;
  localDate?: string;
}) {
  const [editing, setEditing] = useState<BookingView | null | undefined>();
  const priorityBooking = selectPriorityBooking(bookings, experiencePhase, localDate);
  const remainingBookings = bookings.filter((booking) => booking.id !== priorityBooking?.id);
  const priorityCopy = priorityMessage(experiencePhase);
  return (
    <VStack className="bookings-panel" gap={3}>
      <HStack className="bookings-panel__intro" gap={3}>
        <VStack gap={1}>
          <Text className="bookings-panel__eyebrow" type="label">예약 보관함 · {bookings.length}개</Text>
          <Text type="body">항공권, 숙소, 이용권을 한곳에서 확인하세요.</Text>
        </VStack>
        <Button isDisabled={!controller} label="예약 추가" onClick={() => setEditing(null)} variant="primary" />
      </HStack>
      {priorityBooking ? (
        <section className="booking-priority-section" aria-labelledby="booking-priority-title">
          <Text className="booking-priority-section__label" id="booking-priority-title" type="label">
            {priorityCopy.label}
          </Text>
          <article className="booking-card booking-card--priority">
            <HStack className="booking-card__heading" gap={2}>
              <HStack className="booking-card__identity" gap={2}>
                <span className="booking-card__icon"><Icon icon={bookingIcon()} size="sm" /></span>
                <VStack gap={1}>
                  <h4>{priorityBooking.provider}</h4>
                  <p><time>{formatDateTime(priorityBooking.startsAt)}</time> · {payments[priorityBooking.paymentStatus]}</p>
                </VStack>
              </HStack>
              <Text className="booking-card__type" type="label">{bookingTypes[priorityBooking.bookingType]}</Text>
            </HStack>
            <Text className="booking-card__priority-copy" type="body">{priorityCopy.description}</Text>
            <ReservationCode value={priorityBooking.reservationCode} />
            <BookingActions booking={priorityBooking} controller={controller} onEdit={() => setEditing(priorityBooking)} primary />
          </article>
        </section>
      ) : null}
      {remainingBookings.length > 0 ? (
        <section className="booking-remaining-section" aria-labelledby="booking-remaining-title">
          <Text className="booking-priority-section__label" id="booking-remaining-title" type="label">
            그 외 예약 {remainingBookings.length}개
          </Text>
          <ul className="booking-list booking-list--compact">
            {remainingBookings.map((booking) => (
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
              <BookingActions booking={booking} controller={controller} onEdit={() => setEditing(booking)} />
            </article>
          </li>
            ))}
          </ul>
        </section>
      ) : null}
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

function BookingActions({
  booking,
  controller,
  onEdit,
  primary = false
}: {
  booking: BookingView;
  controller?: TripMutationController;
  onEdit: () => void;
  primary?: boolean;
}) {
  return (
    <HStack className="booking-card__actions" gap={2}>
      {isSafeExternalHttpsUrl(booking.externalUrl) ? <a className={primary ? "booking-card__primary-action" : undefined} href={booking.externalUrl} rel="noreferrer noopener" target="_blank">예약 정보 보기</a> : null}
      {isSafeExternalHttpsUrl(booking.documentUrl) ? <a href={booking.documentUrl} rel="noreferrer noopener" target="_blank">문서 열기</a> : null}
      {controller ? <Button label="수정" onClick={onEdit} size="sm" variant="secondary" /> : null}
    </HStack>
  );
}

function selectPriorityBooking(bookings: BookingView[], phase: ExperiencePhase, localDate?: string): BookingView | null {
  const ordered = [...bookings].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  if (ordered.length === 0 || phase === "after") return null;
  if (phase === "during" && localDate) {
    return ordered.find((booking) => booking.startsAt.startsWith(localDate))
      ?? ordered.find((booking) => booking.startsAt >= `${localDate}T00:00`)
      ?? ordered[0]
      ?? null;
  }
  return ordered[0] ?? null;
}

function priorityMessage(phase: ExperiencePhase): { label: string; description: string } {
  if (phase === "during") {
    return { label: "지금 확인할 예약", description: "오늘의 바우처와 체크인 정보를 바로 확인하세요." };
  }
  return { label: "출발 전 확인할 예약", description: "출발 전에 예약 정보와 필요한 준비물을 확인하세요." };
}

function bookingIcon(): "calendar" {
  return "calendar";
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}
