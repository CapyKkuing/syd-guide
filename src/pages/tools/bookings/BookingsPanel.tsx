import { useMemo, useState } from "react";
import { Button, HStack, Icon, Text, VStack } from "@astryxdesign/core";
import type { BookingView, ScheduleItemView } from "../../../data/contracts";
import type { MemberRole } from "../../../shared/entities";
import type { MediaApi } from "../../../services/media/api";
import type { MediaStorageProviderClient } from "../../../services/media/provider";
import {
  createBookingDocumentRuntime,
  type BookingDocumentRuntime,
} from "../../../services/media/bookingDocumentRuntime";
import type { ExperiencePhase } from "../../../domain/tripPhase";
import type { TripMutationController } from "../../../services/mutations/controller";
import { BookingEditorDialog } from "./BookingEditorDialog";
import { BookingDetailSheet } from "./BookingDetailSheet";

const payments = { unpaid: "미결제", partial: "일부 결제", paid: "결제 완료", refunded: "환불" };
const bookingTypes = {
  flight: "항공", lodging: "숙소", ticket: "입장권", tour: "투어",
  transport: "교통", restaurant: "식당", other: "기타"
};

export function BookingsPanel({
  bookings,
  controller,
  documentRuntime: suppliedDocumentRuntime,
  places,
  mediaApi,
  mediaProvider,
  scheduleItems = [],
  timeZone,
  tripId,
  viewerRole,
  experiencePhase = "before",
  localDate,
  initialBookingType
}: {
  bookings: BookingView[];
  controller?: TripMutationController;
  documentRuntime?: BookingDocumentRuntime;
  places: Array<{ id: string; name: string }>;
  mediaApi?: MediaApi;
  mediaProvider?: MediaStorageProviderClient;
  scheduleItems?: ScheduleItemView[];
  timeZone: string;
  tripId?: string;
  viewerRole?: MemberRole;
  experiencePhase?: ExperiencePhase;
  localDate?: string;
  initialBookingType?: "lodging";
}) {
  const [editing, setEditing] = useState<BookingView | null | undefined>(
    initialBookingType ? null : undefined
  );
  const [selected, setSelected] = useState<BookingView | null>(null);
  const [detailReturnFocusTo, setDetailReturnFocusTo] = useState<HTMLElement | null>(null);
  const documentRuntime = useMemo(
    () => suppliedDocumentRuntime ?? (
      mediaApi && mediaProvider && tripId && viewerRole
        ? createBookingDocumentRuntime({
          api: mediaApi,
          provider: mediaProvider,
          tripId,
          viewerRole,
        })
        : undefined
    ),
    [mediaApi, mediaProvider, suppliedDocumentRuntime, tripId, viewerRole]
  );
  const priorityBooking = selectPriorityBooking(bookings, experiencePhase, localDate);
  const remainingBookings = bookings.filter((booking) => booking.id !== priorityBooking?.id);
  const priorityCopy = priorityMessage(experiencePhase);
  const phaseNotice = phaseMessage(experiencePhase);

  function openDetail(booking: BookingView, trigger: HTMLElement) {
    setDetailReturnFocusTo(trigger);
    setSelected(booking);
  }

  return (
    <VStack className="bookings-panel" gap={3}>
      <HStack className="bookings-panel__intro" gap={3}>
        <VStack gap={1}>
          <Text className="bookings-panel__eyebrow" type="label">예약 보관함 · {bookings.length}개</Text>
          <Text type="body">항공권, 숙소, 이용권을 한곳에서 확인하세요.</Text>
        </VStack>
        <Button isDisabled={!controller} label="예약 추가" onClick={() => setEditing(null)} variant="primary" />
      </HStack>
      {experiencePhase !== "after" ? <Text className="bookings-panel__phase-note" type="body">{phaseNotice}</Text> : null}
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
            <button className="booking-card__primary-action" onClick={(event) => openDetail(priorityBooking, event.currentTarget)} type="button">
              {priorityActionLabel(priorityBooking)}
            </button>
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
                <button className="booking-list__item" onClick={(event) => openDetail(booking, event.currentTarget)} type="button">
                  <span className="booking-list__icon"><Icon icon={bookingIcon()} size="sm" /></span>
                  <span className="booking-list__copy">
                    <strong>{booking.provider}</strong>
                    <span><time>{formatDateTime(booking.startsAt)}</time> · {payments[booking.paymentStatus]}</span>
                  </span>
                  <span className="booking-card__type">{bookingTypes[booking.bookingType]}</span>
                  <span className="booking-list__chevron" aria-hidden="true">›</span>
                </button>
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
      {editing !== undefined && controller ? <BookingEditorDialog booking={editing} controller={controller} documentRuntime={documentRuntime} initialBookingType={editing ? undefined : initialBookingType} onClose={() => setEditing(undefined)} places={places} scheduleItems={scheduleItems} timeZone={timeZone} tripId={tripId} /> : null}
      {selected ? (
        <BookingDetailSheet
          booking={selected}
          documentRuntime={documentRuntime}
          onClose={() => setSelected(null)}
          onEdit={controller ? () => { setSelected(null); setEditing(selected); } : undefined}
          placeName={places.find((place) => place.id === selected.placeId)?.name}
          returnFocusTo={detailReturnFocusTo}
        />
      ) : null}
    </VStack>
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

function phaseMessage(phase: ExperiencePhase): string {
  if (phase === "during") return "여행 중에는 오늘의 바우처와 체크인 정보를 먼저 확인하세요.";
  return "출발 전에는 예약 번호와 필요한 문서를 한곳에서 확인하세요.";
}

function priorityActionLabel(booking: BookingView): string {
  if (booking.bookingType === "flight") return "체크인 · 예약 정보 보기";
  if (booking.bookingType === "lodging") return "체크인 · 예약 정보 보기";
  return "예약 정보 보기";
}

function bookingIcon(): "calendar" {
  return "calendar";
}

function formatDateTime(value: string): string {
  return value.slice(0, 16).replace("T", " ");
}
