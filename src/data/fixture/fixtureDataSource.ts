import type {
  MapPreviewViewModel,
  ScheduleItemView,
  ScheduleViewModel,
  TodayViewModel,
  ToolGroupView,
  ToolsViewModel,
  TravelGuideDataSource,
  TripContextViewModel,
  TripPhase,
  TripSummaryViewModel
} from "../contracts";
import { pathForAsset } from "../../app/basePath";

type TripDefinition = Omit<TripSummaryViewModel,
  "startDate" | "endDate" | "phase" | "experiencePhase" | "updatedAt"
  | "hasOutboundFlight" | "hasReturnFlight" | "representativeMediaId"
> & {
  startOffsetDays: number;
  endOffsetDays: number;
};

type LocalDateTime = {
  date: string;
  hours: number;
  minutes: number;
};

const tripDefinitions: readonly TripDefinition[] = [
  {
    id: "sydney-2026",
    title: "시드니 여행",
    country: "Australia",
    destination: "Sydney",
    timeZone: "Australia/Sydney",
    coverImageUrl: pathForAsset("images/sydney_harbour_bridge.jpg"),
    travelerCount: 2,
    bookingCount: 3,
    startOffsetDays: -1,
    endOffsetDays: 2
  },
  {
    id: "bondi-weekend",
    title: "본다이 주말",
    country: "Australia",
    destination: "Bondi Beach",
    timeZone: "Australia/Sydney",
    coverImageUrl: pathForAsset("images/bondi_beach.jpg"),
    travelerCount: 2,
    bookingCount: 1,
    startOffsetDays: 14,
    endOffsetDays: 16
  },
  {
    id: "blue-mountains-memory",
    title: "블루 마운틴 추억",
    country: "Australia",
    destination: "Blue Mountains",
    timeZone: "Australia/Sydney",
    coverImageUrl: pathForAsset("images/blue_mountains.jpg"),
    travelerCount: 2,
    bookingCount: 2,
    startOffsetDays: -30,
    endOffsetDays: -27
  }
];

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const match = parts.find((entry) => entry.type === type);
  if (!match) throw new Error(`Missing ${type} date part`);
  return match.value;
}

function localDateTime(date: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  return {
    date: `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`,
    hours: Number(part(parts, "hour")),
    minutes: Number(part(parts, "minute"))
  };
}

function addDays(date: string, offset: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return shifted.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toTime - fromTime) / 86_400_000);
}

function phaseFor(localDate: string, startDate: string, endDate: string): TripPhase {
  if (localDate < startDate) return "upcoming";
  if (localDate > endDate) return "completed";
  return "active";
}

function dayLabel(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60
  ).padStart(2, "0")}`;
}

function formatCountdown(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}분 후`;
  if (remainingMinutes === 0) return `${hours}시간 후`;
  return `${hours}시간 ${remainingMinutes}분 후`;
}

function makeScheduleItem(
  id: string,
  date: string,
  startsAt: string,
  endsAt: string | null,
  title: string,
  place: string,
  description: string,
  kind: ScheduleItemView["kind"],
  options: Pick<
    ScheduleItemView,
    "travelMode" | "travelNote" | "bookingStatus" | "isDone" | "mapUrl"
  >
): ScheduleItemView {
  return {
    id,
    version: 1,
    tripDayId: `preview-${date}`,
    placeId: null,
    bookingId: null,
    bookingProvider: null,
    updatedAt: `${date}T${startsAt}:00`,
    startsAt: `${date}T${startsAt}:00`,
    endsAt: endsAt ? `${date}T${endsAt}:00` : null,
    title,
    place,
    description,
    kind,
    position: 0,
    isFixed: false,
    ...options
  };
}

function toolGroups(): ToolGroupView[] {
  return [
    {
      id: "essentials",
      title: "Travel Essentials",
      items: [
        { id: "bookings", label: "예약·바우처", description: "예약 정보를 한곳에서 확인합니다.", status: "available" },
        { id: "exchange", label: "환율", description: "AUD와 KRW를 직접 환산합니다.", status: "available" },
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
        { id: "checklist", label: "체크리스트", description: "함께 또는 개인 준비물을 관리합니다.", status: "available" },
        { id: "notes", label: "여행 메모", description: "공유 또는 개인 메모를 관리합니다.", status: "available" },
        { id: "tips", label: "주의사항", description: "여행 주의사항은 준비 중입니다.", status: "preview" },
        { id: "ai-connect", label: "AI 앱 연결", description: "민감정보를 제외한 질문을 만들고 선택한 AI를 엽니다.", status: "available" },
        { id: "partner-connect", label: "파트너 연결", description: "파트너 연결은 준비 중입니다.", status: "preview" },
        { id: "devices", label: "연결 기기 관리", description: "연결한 기기를 관리합니다.", status: "available" },
        { id: "theme", label: "테마", description: "화면 테마를 선택합니다.", status: "available" },
        { id: "offline-sync", label: "오프라인·동기화 상태", description: "오프라인 상태를 확인합니다.", status: "available" }
      ]
    }
  ];
}

export class FixtureTravelGuideDataSource implements TravelGuideDataSource {
  // ESLint's base no-unused-vars rule does not recognize TypeScript parameter properties.
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly clock: () => Date = () => new Date()) {}

  async listTrips(): Promise<TripSummaryViewModel[]> {
    return this.trips();
  }

  async getTripContext(tripId: string): Promise<TripContextViewModel | null> {
    const trip = this.tripById(tripId);
    if (!trip) return null;

    const local = localDateTime(this.clock(), trip.timeZone);
    return {
      trip,
      trips: this.trips(),
      localDate: local.date,
      dayLabel: dayLabel(local.date, trip.timeZone),
      viewer: {
        memberId: "preview-owner",
        displayName: "민지",
        role: "owner",
        access: "full"
      },
      partnerStatus: "connected"
    };
  }

  async getToday(tripId: string): Promise<TodayViewModel | null> {
    const trip = this.tripById(tripId);
    if (!trip) return null;

    const local = localDateTime(this.clock(), trip.timeZone);
    const schedule = this.scheduleFor(trip, local.date);
    const phaseToday = schedule.days.find((day) => day.date === local.date) ?? schedule.days[0];
    if (!phaseToday) throw new Error("Fixture schedule requires at least one day");
    const scheduleContextDate = trip.phase === "upcoming"
      ? phaseToday.date
      : trip.phase === "completed"
        ? trip.endDate
        : local.date;

    const common = {
      phase: trip.phase,
      experiencePhase: trip.experiencePhase,
      localDate: scheduleContextDate,
      dayLabel: dayLabel(scheduleContextDate, trip.timeZone),
      weather: {
        location: trip.destination,
        condition: "맑음",
        temperatureC: 21,
        uvIndex: 5,
        isSample: true as const
      },
      expenses: [],
      expenseTotals: [],
      unsettledExpenseCount: 0
    };

    if (trip.phase === "upcoming") {
      return {
        ...common,
        greeting: "여행까지",
        headline: "첫날 미리보기",
        dDay: daysBetween(local.date, trip.startDate),
        nextMovement: null,
        booking: { provider: "Icebergs Dining Room", place: "Icebergs Dining Room", time: "19:00", type: "디너 예약", status: "confirmed" },
        schedule: phaseToday.items,
        summary: null
      };
    }

    if (trip.phase === "completed") {
      return {
        ...common,
        greeting: "여행 완료",
        headline: "일정 다시 보기",
        dDay: null,
        nextMovement: null,
        booking: null,
        schedule: schedule.days.flatMap((day) => day.items),
        summary: { visitedPlaceCount: 4, completedItemCount: 6 }
      };
    }

    const currentMinutes = local.hours * 60 + local.minutes;
    const departureMinutes = Math.ceil((currentMinutes + 90) / 15) * 15;
    return {
      ...common,
      greeting: "NEXT UP",
      headline: "오늘 일정",
      dDay: 0,
      nextMovement: {
        departureTime: formatTime(departureMinutes),
        countdownLabel: formatCountdown(departureMinutes - currentMinutes),
        origin: "Meriton Sussex Street",
        destination: "Sydney Opera House",
        mode: "transit",
        routeSummary: "Light rail L2와 도보 약 28분",
        mapUrl: "https://www.google.com/maps/dir/Meriton+Suites+Sussex+Street/Sydney+Opera+House"
      },
      booking: { provider: "Quay", place: "Quay", time: "19:30", type: "디너 예약", status: "confirmed" },
      schedule: phaseToday.items,
      summary: null
    };
  }

  async getSchedule(tripId: string): Promise<ScheduleViewModel | null> {
    const trip = this.tripById(tripId);
    if (!trip) return null;
    return this.scheduleFor(trip, localDateTime(this.clock(), trip.timeZone).date);
  }

  async getMapPreview(tripId: string): Promise<MapPreviewViewModel | null> {
    const trip = this.tripById(tripId);
    if (!trip) return null;

    const localDate = localDateTime(this.clock(), trip.timeZone).date;
    const [firstDay, secondDay, thirdDay] = this.scheduleFor(trip, localDate).days;
    if (!firstDay || !secondDay || !thirdDay) {
      throw new Error("Fixture map requires three schedule days");
    }
    return {
      places: [
        {
          id: "meriton-sussex-street",
          version: 1,
          name: "Meriton Sussex Street",
          category: "lodging",
          status: "visited",
          dayDate: firstDay.date,
          latitude: -33.8723,
          longitude: 151.2035,
          address: "234 Sussex St, Sydney NSW 2000",
          description: "숙소",
          mapUrl: "https://www.google.com/maps/search/?api=1&query=Meriton+Suites+Sussex+Street",
          sourceUrl: null,
          imageUrl: null,
          savedBy: "preview-owner",
          updatedAt: `${firstDay.date}T09:00:00`,
          votes: []
        },
        {
          id: "sydney-opera-house",
          version: 1,
          name: "Sydney Opera House",
          category: "attraction",
          status: "saved",
          dayDate: secondDay.date,
          latitude: -33.8568,
          longitude: 151.2153,
          address: "Bennelong Point, Sydney NSW 2000",
          description: "하버 명소",
          mapUrl: "https://www.google.com/maps/search/?api=1&query=Sydney+Opera+House",
          sourceUrl: null,
          imageUrl: null,
          savedBy: "preview-owner",
          updatedAt: `${secondDay.date}T09:00:00`,
          votes: []
        },
        {
          id: "sample-coffee",
          version: 1,
          name: "Sample Coffee",
          category: "cafe",
          status: "maybe",
          dayDate: thirdDay.date,
          latitude: -33.885,
          longitude: 151.173,
          address: "1/1a Larkin St, Camperdown NSW 2050",
          description: "카페",
          mapUrl: "https://www.google.com/maps/search/?api=1&query=Sample+Coffee+Sydney",
          sourceUrl: null,
          imageUrl: null,
          savedBy: "preview-owner",
          updatedAt: `${thirdDay.date}T09:00:00`,
          votes: []
        },
        {
          id: "quay",
          version: 1,
          name: "Quay",
          category: "restaurant",
          status: "saved",
          dayDate: secondDay.date,
          latitude: -33.8585,
          longitude: 151.209,
          address: "Upper Level, Overseas Passenger Terminal, The Rocks NSW 2000",
          description: "레스토랑",
          mapUrl: "https://www.google.com/maps/search/?api=1&query=Quay+Sydney",
          sourceUrl: null,
          imageUrl: null,
          savedBy: "preview-owner",
          updatedAt: `${secondDay.date}T18:00:00`,
          votes: []
        }
      ]
    };
  }

  async getTools(tripId: string): Promise<ToolsViewModel | null> {
    const trip = this.tripById(tripId);
    if (!trip) return null;
    return {
      groups: toolGroups(),
      tripId,
      timeZone: trip.timeZone,
      viewerMemberId: "preview-owner",
      members: [{ id: "preview-owner", role: "owner", displayName: "민지" }],
      places: [],
      bookings: [],
      checkItems: [],
      expenses: [],
      notes: [],
      activity: []
    };
  }

  private trips(): TripSummaryViewModel[] {
    return tripDefinitions.map((definition) => this.tripFromDefinition(definition));
  }

  private tripById(tripId: string): TripSummaryViewModel | null {
    const definition = tripDefinitions.find((candidate) => candidate.id === tripId);
    return definition ? this.tripFromDefinition(definition) : null;
  }

  private tripFromDefinition(definition: TripDefinition): TripSummaryViewModel {
    const localDate = localDateTime(this.clock(), definition.timeZone).date;
    const startDate = addDays(localDate, definition.startOffsetDays);
    const endDate = addDays(localDate, definition.endOffsetDays);
    const phase = phaseFor(localDate, startDate, endDate);
    return {
      ...definition,
      startDate,
      endDate,
      phase,
      experiencePhase: phase === "upcoming" ? "before" : phase === "completed" ? "after" : "during",
      hasOutboundFlight: phase !== "upcoming",
      hasReturnFlight: phase !== "upcoming",
      representativeMediaId: null,
      updatedAt: this.clock().toISOString()
    };
  }

  private scheduleFor(trip: TripSummaryViewModel, localDate: string): ScheduleViewModel {
    const firstDate = trip.phase === "active" ? addDays(localDate, -1) : trip.startDate;
    const secondDate = addDays(firstDate, 1);
    const thirdDate = addDays(firstDate, 2);

    return {
      days: [
        {
          id: `preview-${firstDate}`,
          position: 1,
          date: firstDate,
          dayLabel: "DAY 01",
          headline: "도착 후 하버 산책",
          items: [
            makeScheduleItem(
              "hotel-check-in",
              firstDate,
              "14:00",
              "15:00",
              "호텔 체크인",
              "Meriton Sussex Street",
              "짐을 맡기고 객실을 확인합니다.",
              "booking",
              { travelMode: null, travelNote: null, bookingStatus: "confirmed", isDone: trip.phase === "completed", mapUrl: null }
            ),
            makeScheduleItem(
              "harbour-walk",
              firstDate,
              "16:00",
              "18:00",
              "하버 산책",
              "Circular Quay",
              "서큘러 키에서 해 질 무렵의 하버를 걷습니다.",
              "attraction",
              { travelMode: "walk", travelNote: "호텔에서 도보 24분", bookingStatus: null, isDone: trip.phase === "completed", mapUrl: "https://www.google.com/maps/search/?api=1&query=Circular+Quay" }
            )
          ]
        },
        {
          id: `preview-${secondDate}`,
          position: 2,
          date: secondDate,
          dayLabel: "DAY 02",
          headline: "오페라 하우스와 더 록스",
          items: [
            makeScheduleItem(
              "opera-house-tour",
              secondDate,
              "10:30",
              "12:00",
              "오페라 하우스 가이드 투어",
              "Sydney Opera House",
              "예약 확정된 가이드 투어에 참여합니다.",
              "attraction",
              { travelMode: "transit", travelNote: "L2 경전철과 도보", bookingStatus: "confirmed", isDone: trip.phase === "completed", mapUrl: "https://www.google.com/maps/search/?api=1&query=Sydney+Opera+House" }
            ),
            makeScheduleItem(
              "quay-dinner",
              secondDate,
              "19:30",
              "21:30",
              "하버 디너",
              "Quay",
              "하버 전망의 저녁 식사입니다.",
              "meal",
              { travelMode: "walk", travelNote: "오페라 하우스에서 도보 12분", bookingStatus: "confirmed", isDone: trip.phase === "completed", mapUrl: "https://www.google.com/maps/search/?api=1&query=Quay+Sydney" }
            )
          ]
        },
        {
          id: `preview-${thirdDate}`,
          position: 3,
          date: thirdDate,
          dayLabel: "DAY 03",
          headline: "카페와 본다이 해변",
          items: [
            makeScheduleItem(
              "sample-coffee",
              thirdDate,
              "09:00",
              "10:00",
              "아침 커피",
              "Sample Coffee",
              "여유롭게 커피를 마시고 다음 일정을 준비합니다.",
              "meal",
              { travelMode: "transit", travelNote: "버스 15분", bookingStatus: null, isDone: trip.phase === "completed", mapUrl: "https://www.google.com/maps/search/?api=1&query=Sample+Coffee+Sydney" }
            ),
            makeScheduleItem(
              "bondi-walk",
              thirdDate,
              "13:00",
              null,
              "본다이 산책",
              "Bondi Beach",
              "해변 산책과 수영 시간을 남겨 둡니다.",
              "attraction",
              { travelMode: "transit", travelNote: "버스 333", bookingStatus: null, isDone: trip.phase === "completed", mapUrl: "https://www.google.com/maps/search/?api=1&query=Bondi+Beach" }
            )
          ]
        }
      ]
    };
  }
}

export const fixtureTravelGuideDataSource = new FixtureTravelGuideDataSource();
