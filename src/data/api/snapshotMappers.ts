import type { SessionPrincipal } from "../../features/auth/api";
import type { TripSnapshot } from "../../shared/api";
import type { Booking, Place, ScheduleItem } from "../../shared/entities";
import type {
  MapPlaceView,
  ScheduleDayView,
  ScheduleItemView,
  ToolGroupView,
  TripSummaryViewModel,
  TripWorkspace
} from "../contracts";

const toolGroups: ToolGroupView[] = [
  {
    id: "essentials",
    title: "Travel Essentials",
    items: [
      { id: "bookings", label: "예약·바우처", description: "예약 정보를 한곳에서 확인합니다.", status: "preview" },
      { id: "exchange", label: "환율", description: "환율 정보는 준비 중입니다.", status: "preview" },
      { id: "transport", label: "교통", description: "교통 안내는 준비 중입니다.", status: "preview" },
      { id: "emergency", label: "비상 연락처", description: "비상 연락처는 준비 중입니다.", status: "preview" }
    ]
  },
  {
    id: "places",
    title: "Places",
    items: [
      { id: "restaurants", label: "맛집", description: "맛집 목록은 준비 중입니다.", status: "preview" },
      { id: "cafes", label: "카페", description: "카페 목록은 준비 중입니다.", status: "preview" },
      { id: "saved-places", label: "저장 장소", description: "저장 장소 기능은 준비 중입니다.", status: "preview" }
    ]
  },
  {
    id: "planning",
    title: "Planning & Settings",
    items: [
      { id: "checklist", label: "체크리스트", description: "체크리스트는 준비 중입니다.", status: "preview" },
      { id: "notes", label: "여행 메모", description: "여행 메모는 준비 중입니다.", status: "preview" },
      { id: "tips", label: "주의사항", description: "여행 주의사항은 준비 중입니다.", status: "preview" },
      { id: "ai-connect", label: "AI 앱 연결", description: "AI 앱 연결은 준비 중입니다.", status: "preview" },
      { id: "partner-connect", label: "파트너 연결", description: "파트너 연결은 준비 중입니다.", status: "preview" },
      { id: "devices", label: "연결 기기 관리", description: "연결한 기기를 관리합니다.", status: "available" },
      { id: "theme", label: "테마", description: "화면 테마를 선택합니다.", status: "available" },
      { id: "offline-sync", label: "오프라인·동기화 상태", description: "오프라인 상태를 확인합니다.", status: "available" }
    ]
  }
];

export function mapSnapshotToWorkspace(
  snapshot: TripSnapshot,
  principal: SessionPrincipal,
  now: Date
): TripWorkspace {
  const trip = mapTrip(snapshot);
  const localDate = dateInZone(now, trip.timeZone);
  const places = new Map(snapshot.places.map((place) => [place.id, place]));
  const bookings = new Map(snapshot.bookings.map((booking) => [booking.id, booking]));
  const orderedDays = [...snapshot.days].sort((left, right) =>
    left.position - right.position || left.id.localeCompare(right.id)
  );
  const scheduleDays = orderedDays.map((day, index) => ({
    id: day.id,
    position: day.position,
    date: day.dayDate,
    dayLabel: `DAY ${String(index + 1).padStart(2, "0")}`,
    headline: day.title || "일정",
    items: snapshot.scheduleItems
      .filter((item) => item.tripDayId === day.id)
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
      .map((item) => mapScheduleItem(item, day.dayDate, places, bookings))
  }));
  const todayDay = selectTodayDay(scheduleDays, trip.phase, localDate);
  const todayItems = todayDay?.items ?? [];
  const viewer = snapshot.members.find((member) => member.id === principal.memberId);
  const nextMovement = trip.phase === "completed"
    ? null
    : todayItems.find((item) =>
      item.kind === "movement" && new Date(item.startsAt).getTime() > now.getTime()
    ) ?? null;
  const nextBooking = trip.phase === "completed"
    ? null
    : [...snapshot.bookings]
      .filter((booking) => new Date(booking.startsAt).getTime() > now.getTime())
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0] ?? null;

  return {
    context: {
      trip,
      trips: [trip],
      localDate,
      dayLabel: todayDay?.dayLabel ?? "DAY 01",
      viewer: {
        displayName: viewer?.displayName ?? "여행자",
        role: principal.role
      },
      partnerStatus: snapshot.members.some((member) => member.role === "partner")
        ? "connected"
        : "not-connected"
    },
    schedule: { days: scheduleDays },
    today: {
      phase: trip.phase,
      localDate: todayDay?.date ?? localDate,
      dayLabel: koreanDate(todayDay?.date ?? localDate),
      greeting: trip.phase === "upcoming" ? "여행까지" : trip.phase === "active" ? "NEXT UP" : "여행 완료",
      headline: trip.phase === "upcoming" ? "첫날 미리보기" : trip.phase === "active" ? "오늘 일정" : "일정 다시 보기",
      dDay: trip.phase === "upcoming" ? daysBetween(localDate, trip.startDate) : trip.phase === "active" ? 0 : null,
      weather: { location: trip.destination, condition: "맑음", temperatureC: 21, uvIndex: 5, isSample: true },
      nextMovement: nextMovement ? {
        departureTime: timeOf(nextMovement.startsAt),
        countdownLabel: countdown(new Date(nextMovement.startsAt).getTime() - now.getTime()),
        origin: trip.destination,
        destination: nextMovement.place || nextMovement.title,
        mode: nextMovement.travelMode ?? "walk",
        routeSummary: nextMovement.travelNote ?? nextMovement.description,
        mapUrl: nextMovement.mapUrl
      } : null,
      booking: nextBooking ? mapTodayBooking(nextBooking, places) : null,
      budget: { spentAud: 385, limitAud: 1_800, isSample: true },
      schedule: todayItems,
      summary: trip.phase === "completed" ? {
        visitedPlaceCount: snapshot.places.filter((place) => place.status === "visited").length,
        completedItemCount: snapshot.scheduleItems.filter((item) => item.isDone).length
      } : null
    },
    mapPreview: { places: mapPlaces(snapshot) },
    tools: { groups: toolGroups }
  };
}

function mapTrip(snapshot: TripSnapshot): TripSummaryViewModel {
  const parts = snapshot.trip.destination.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    id: snapshot.trip.id,
    title: snapshot.trip.title,
    country: parts.length > 1 ? parts.at(-1)! : "",
    destination: parts[0] ?? snapshot.trip.destination,
    startDate: snapshot.trip.startDate,
    endDate: snapshot.trip.endDate,
    timeZone: snapshot.trip.timeZone,
    phase: snapshot.trip.status,
    coverImageUrl: snapshot.trip.coverImageUrl ?? "",
    travelerCount: snapshot.members.length,
    bookingCount: snapshot.bookings.length,
    updatedAt: snapshot.trip.updatedAt
  };
}

function mapScheduleItem(
  item: ScheduleItem,
  dayDate: string,
  places: Map<string, Place>,
  bookings: Map<string, Booking>
): ScheduleItemView {
  const place = item.placeId ? places.get(item.placeId) : undefined;
  const booking = item.bookingId ? bookings.get(item.bookingId) : undefined;
  const travelMode = item.travelMode === "other" ? null : item.travelMode;
  return {
    id: item.id,
    version: item.version,
    tripDayId: item.tripDayId,
    placeId: item.placeId,
    bookingId: item.bookingId,
    startsAt: item.startsAt ?? `${dayDate}T00:00:00`,
    endsAt: item.endsAt,
    title: item.title,
    place: place?.name ?? "",
    description: item.memo,
    kind: travelMode
      ? "movement"
      : booking
        ? "booking"
        : place?.category === "restaurant" || place?.category === "cafe"
          ? "meal"
          : place?.category === "attraction"
            ? "attraction"
            : "note",
    travelMode,
    travelNote: item.travelNote || null,
    bookingStatus: booking ? booking.paymentStatus === "unpaid" ? "pending" : "confirmed" : null,
    position: item.position,
    isFixed: item.isFixed,
    isDone: item.isDone,
    mapUrl: place?.mapUrl ?? null
  };
}

function mapPlaces(snapshot: TripSnapshot): MapPlaceView[] {
  const located = snapshot.places.filter(validCoordinates);
  const latitudes = located.map((place) => place.latitude!);
  const longitudes = located.map((place) => place.longitude!);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  return snapshot.places.map((place) => {
    const item = snapshot.scheduleItems.find((candidate) => candidate.placeId === place.id);
    const day = item ? snapshot.days.find((candidate) => candidate.id === item.tripDayId) : undefined;
    return {
      id: place.id,
      name: place.name,
      category: place.category,
      status: place.status,
      dayDate: day?.dayDate ?? snapshot.trip.startDate,
      x: validCoordinates(place) ? scale(place.longitude!, minLng, maxLng, 100) : null,
      y: validCoordinates(place) ? scale(maxLat - place.latitude!, 0, maxLat - minLat, 70) : null,
      address: place.address ?? "",
      mapUrl: place.mapUrl
    };
  });
}

function selectTodayDay(days: ScheduleDayView[], phase: TripSummaryViewModel["phase"], localDate: string) {
  if (phase === "upcoming") return days[0];
  if (phase === "completed") return days.at(-1);
  return days.find((day) => day.date === localDate) ?? days[0];
}

function mapTodayBooking(booking: Booking, places: Map<string, Place>) {
  const labels: Record<Booking["bookingType"], string> = {
    flight: "항공", lodging: "숙소", ticket: "입장권", tour: "투어",
    transport: "교통", restaurant: "레스토랑", other: "기타"
  };
  return {
    place: (booking.placeId ? places.get(booking.placeId)?.name : null) ?? booking.provider,
    time: timeOf(booking.startsAt),
    type: labels[booking.bookingType],
    status: booking.paymentStatus === "unpaid" ? "pending" as const : "confirmed" as const
  };
}

function dateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function koreanDate(date: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long", day: "numeric", weekday: "long", timeZone: "UTC"
  }).format(new Date(`${date}T12:00:00Z`));
}

function validCoordinates(place: Place): boolean {
  return place.latitude !== null && place.longitude !== null
    && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    && Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180;
}

function scale(value: number, minimum: number, maximum: number, size: number): number {
  return maximum === minimum ? size / 2 : Math.round(((value - minimum) / (maximum - minimum)) * size);
}

function timeOf(value: string): string {
  return value.slice(11, 16);
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
}

function countdown(milliseconds: number): string {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}시간 ${minutes % 60}분 후` : `${minutes}분 후`;
}
