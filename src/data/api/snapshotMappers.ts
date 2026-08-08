import type { SessionPrincipal } from "../../features/auth/api";
import { deriveExperiencePhase } from "../../domain/tripPhase";
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
      { id: "bookings", label: "예약·바우처", description: "예약 정보를 한곳에서 확인합니다.", status: "available" },
      { id: "exchange", label: "환율", description: "AUD와 KRW를 직접 환산합니다.", status: "available" },
      { id: "transport", label: "교통", description: "공식 실시간 정보와 일정 이동 구간을 한곳에서 확인합니다.", status: "available" },
      { id: "emergency", label: "비상 연락처", description: "호주 긴급번호와 영사관·숙소 연락 정보를 확인합니다.", status: "available" }
    ]
  },
  {
    id: "places",
    title: "Places",
    items: [
      { id: "restaurants", label: "맛집", description: "Google 최신 추천과 저장한 맛집을 함께 확인합니다.", status: "available" },
      { id: "cafes", label: "카페", description: "Google 최신 추천과 저장한 카페를 함께 확인합니다.", status: "available" },
      { id: "saved-places", label: "저장 장소", description: "지도에서 저장한 장소를 확인하고 수정합니다.", status: "available" }
    ]
  },
  {
    id: "planning",
    title: "Planning",
    items: [
      { id: "checklist", label: "체크리스트", description: "함께 또는 개인 준비물을 관리합니다.", status: "available" },
      { id: "notes", label: "여행 메모", description: "공유 또는 개인 메모를 관리합니다.", status: "available" },
      { id: "tips", label: "주의사항", description: "교통·결제·자외선·비상 연락 핵심 정보를 확인합니다.", status: "available" },
      { id: "ai-connect", label: "AI 앱 연결", description: "민감정보를 제외한 질문을 만들고 선택한 AI를 엽니다.", status: "available" },
      { id: "partner-connect", label: "참여자 연결", description: "참여자별 기기를 연결합니다.", status: "preview" },
      { id: "devices", label: "초대·기기 관리", description: "참여자 초대와 연결 기기를 한곳에서 관리합니다.", status: "available" },
      { id: "theme", label: "테마", description: "화면 테마를 선택합니다.", status: "available" },
      { id: "offline-sync", label: "오프라인·동기화 상태", description: "오프라인 상태를 확인합니다.", status: "available" }
    ]
  }
];

export function mapSnapshotToWorkspace(
  snapshot: TripSnapshot,
  principal: SessionPrincipal | null,
  now: Date
): TripWorkspace {
  const trip = mapTrip(snapshot, now);
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
  const todayDay = selectTodayDay(scheduleDays, trip.experiencePhase, localDate);
  const todayItems = todayDay?.items ?? [];
  const viewer = principal
    ? snapshot.members.find((member) => member.id === principal.memberId)
    : undefined;
  const viewerMemberId = principal?.memberId ?? "";
  const viewerRole = principal?.role ?? "partner";
  const nextMovement = trip.experiencePhase === "after"
    ? null
    : todayItems.find((item) =>
      item.kind === "movement" && new Date(item.startsAt).getTime() > now.getTime()
    ) ?? null;
  const nextBooking = trip.experiencePhase === "after"
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
        memberId: viewerMemberId,
        displayName: viewer?.displayName ?? "여행자",
        role: viewerRole,
        access: principal ? "full" : "offline-readonly"
      },
      partnerStatus: snapshot.members.length > 1
        ? "connected"
        : "not-connected"
    },
    schedule: { days: scheduleDays },
    today: {
      phase: trip.phase,
      experiencePhase: trip.experiencePhase,
      localDate: todayDay?.date ?? localDate,
      dayLabel: koreanDate(todayDay?.date ?? localDate),
      greeting: trip.experiencePhase === "before" ? "여행까지" : trip.experiencePhase === "during" ? "NEXT UP" : "여행 완료",
      headline: trip.experiencePhase === "before" ? "출발 준비" : trip.experiencePhase === "during" ? "오늘 일정" : "여행 기록",
      dDay: trip.experiencePhase === "before" ? daysBetween(localDate, trip.startDate) : trip.experiencePhase === "during" ? 0 : null,
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
      expenses: snapshot.expenses,
      expenseTotals: expenseTotals(snapshot.expenses),
      unsettledExpenseCount: snapshot.expenses.filter((expense) => !expense.isSettled).length,
      schedule: todayItems,
      summary: trip.experiencePhase === "after" ? {
        visitedPlaceCount: snapshot.places.filter((place) => place.status === "visited").length,
        completedItemCount: snapshot.scheduleItems.filter((item) => item.isDone).length
      } : null
    },
    mapPreview: { places: mapPlaces(snapshot) },
    tools: {
      groups: toolGroups,
      tripId: snapshot.trip.id,
      timeZone: snapshot.trip.timeZone,
      viewerMemberId,
      members: snapshot.members,
      places: snapshot.places.map((place) => ({ id: place.id, name: place.name })),
      bookings: snapshot.bookings,
      checkItems: snapshot.checkItems,
      expenses: snapshot.expenses,
      settlementTransfers: snapshot.settlementTransfers ?? [],
      notes: snapshot.notes,
      activity: snapshot.activity.slice(0, 100).map((entry) => ({
        id: entry.id,
        action: entry.action,
        summary: entry.summary,
        createdAt: entry.createdAt
      }))
    },
    media: snapshot.media ?? [],
    mediaStorage: snapshot.mediaStorage ?? null
  };
}

function mapTrip(snapshot: TripSnapshot, now: Date): TripSummaryViewModel {
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
    experiencePhase: deriveExperiencePhase({
      journeyStartsAt: snapshot.trip.journeyStartsAt,
      journeyEndsAt: snapshot.trip.journeyEndsAt,
      fallbackStatus: snapshot.trip.status,
    }, now),
    coverImageUrl: snapshot.trip.coverImageUrl ?? "",
    travelerCount: snapshot.members.length,
    bookingCount: snapshot.bookings.length,
    hasOutboundFlight: snapshot.trip.outboundFlight !== null,
    hasReturnFlight: snapshot.trip.returnFlight !== null,
    representativeMediaId: snapshot.trip.representativeMediaId,
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
    bookingProvider: booking?.provider ?? null,
    updatedAt: item.updatedAt,
    position: item.position,
    isFixed: item.isFixed,
    isDone: item.isDone,
    mapUrl: place?.mapUrl ?? null
  };
}

function mapPlaces(snapshot: TripSnapshot): MapPlaceView[] {
  return snapshot.places.map((place) => {
    const item = snapshot.scheduleItems.find((candidate) => candidate.placeId === place.id);
    const day = item ? snapshot.days.find((candidate) => candidate.id === item.tripDayId) : undefined;
    return {
      id: place.id,
      version: place.version,
      name: place.name,
      category: place.category,
      status: place.status,
      dayDate: day?.dayDate ?? null,
      latitude: validCoordinates(place) ? place.latitude : null,
      longitude: validCoordinates(place) ? place.longitude : null,
      address: place.address ?? "",
      description: place.description,
      mapUrl: place.mapUrl,
      sourceUrl: place.sourceUrl,
      imageUrl: place.imageUrl,
      savedBy: place.savedBy,
      isRecommended: place.isRecommended,
      isSaved: place.isSaved,
      provider: place.provider,
      providerPlaceId: place.providerPlaceId,
      updatedAt: place.updatedAt,
      votes: snapshot.votes
        .filter((vote) => vote.targetType === "place" && vote.targetId === place.id)
        .map((vote) => ({
          id: vote.id,
          version: vote.version,
          memberId: vote.memberId,
          choice: vote.choice
        }))
    };
  });
}

function selectTodayDay(days: ScheduleDayView[], phase: TripSummaryViewModel["experiencePhase"], localDate: string) {
  if (phase === "before") return days[0];
  if (phase === "after") return days.at(-1);
  return days.find((day) => day.date === localDate) ?? days[0];
}

function expenseTotals(expenses: TripSnapshot["expenses"]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amountMinor);
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amountMinor]) => ({ currency, amountMinor }));
}

function mapTodayBooking(booking: Booking, places: Map<string, Place>) {
  const labels: Record<Booking["bookingType"], string> = {
    flight: "항공", lodging: "숙소", ticket: "입장권", tour: "투어",
    transport: "교통", restaurant: "레스토랑", other: "기타"
  };
  return {
    provider: booking.provider,
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
