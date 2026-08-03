import type {
  ActivityLog,
  Booking,
  CheckItem,
  Expense,
  Note,
  PlaceCategory,
  PlaceStatus,
  PublicMember,
  VoteChoice
} from "../shared/entities";
import type { ExperiencePhase } from "../domain/tripPhase";
import type { TripMedia, TripMediaStorage } from "../shared/media";

export type TripPhase = "upcoming" | "active" | "completed";
export type ScheduleKind =
  | "movement"
  | "meal"
  | "attraction"
  | "booking"
  | "note";

export interface TripSummaryViewModel {
  id: string;
  title: string;
  country: string;
  destination: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  phase: TripPhase;
  experiencePhase: ExperiencePhase;
  coverImageUrl: string;
  travelerCount: number;
  bookingCount: number;
  hasOutboundFlight: boolean;
  hasReturnFlight: boolean;
  representativeMediaId: string | null;
  updatedAt: string;
}

export interface TripContextViewModel {
  trip: TripSummaryViewModel;
  trips: TripSummaryViewModel[];
  localDate: string;
  dayLabel: string;
  viewer: {
    memberId: string;
    displayName: string;
    role: "owner" | "partner";
    access: "full" | "offline-readonly";
  };
  partnerStatus: "connected" | "not-connected";
}

export interface ScheduleItemView {
  id: string;
  version: number;
  tripDayId: string;
  placeId: string | null;
  bookingId: string | null;
  startsAt: string;
  endsAt: string | null;
  title: string;
  place: string;
  description: string;
  kind: ScheduleKind;
  travelMode: "walk" | "transit" | "drive" | "ferry" | null;
  travelNote: string | null;
  bookingStatus: "confirmed" | "pending" | null;
  bookingProvider: string | null;
  updatedAt: string;
  position: number;
  isFixed: boolean;
  isDone: boolean;
  mapUrl: string | null;
}

export interface ScheduleDayView {
  id: string;
  position: number;
  date: string;
  dayLabel: string;
  headline: string;
  items: ScheduleItemView[];
}

export interface TodayViewModel {
  phase: TripPhase;
  experiencePhase: ExperiencePhase;
  localDate: string;
  dayLabel: string;
  greeting: string;
  headline: string;
  dDay: number | null;
  weather: {
    location: string;
    condition: string;
    temperatureC: number;
    uvIndex: number;
    isSample: true;
  };
  nextMovement: {
    departureTime: string;
    countdownLabel: string;
    origin: string;
    destination: string;
    mode: "walk" | "transit" | "drive" | "ferry";
    routeSummary: string;
    mapUrl: string | null;
  } | null;
  booking: {
    provider: string;
    place: string;
    time: string;
    type: string;
    status: "confirmed" | "pending";
  } | null;
  expenses: Expense[];
  expenseTotals: Array<{ currency: string; amountMinor: number }>;
  unsettledExpenseCount: number;
  schedule: ScheduleItemView[];
  summary: {
    visitedPlaceCount: number;
    completedItemCount: number;
  } | null;
}

export interface MapPlaceView {
  id: string;
  version: number;
  name: string;
  category: PlaceCategory;
  status: PlaceStatus;
  dayDate: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string;
  description: string;
  mapUrl: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  savedBy: string | null;
  isRecommended: boolean;
  isSaved: boolean;
  provider: "google-places" | null;
  providerPlaceId: string | null;
  updatedAt: string;
  votes: Array<{
    id: string;
    version: number;
    memberId: string;
    choice: VoteChoice;
  }>;
}

export interface ScheduleViewModel {
  days: ScheduleDayView[];
}

export interface MapPreviewViewModel {
  places: MapPlaceView[];
}

export interface ToolItemView {
  id: string;
  label: string;
  description: string;
  status: "available" | "preview";
}

export interface ToolGroupView {
  id: "essentials" | "places" | "planning";
  title: "Travel Essentials" | "Places" | "Planning";
  items: ToolItemView[];
}

export interface ToolsViewModel {
  groups: ToolGroupView[];
  tripId: string;
  timeZone: string;
  viewerMemberId: string;
  members: PublicMember[];
  places: Array<{ id: string; name: string }>;
  bookings: BookingView[];
  checkItems: CheckItemView[];
  expenses: ExpenseView[];
  notes: NoteView[];
  activity: ActivityView[];
}

export type BookingView = Booking;
export type CheckItemView = CheckItem;
export type ExpenseView = Expense;
export type NoteView = Note;
export type ActivityView = Pick<ActivityLog, "id" | "action" | "summary" | "createdAt">;

export interface TripWorkspace {
  context: TripContextViewModel;
  today: TodayViewModel;
  schedule: ScheduleViewModel;
  mapPreview: MapPreviewViewModel;
  tools: ToolsViewModel;
  media: TripMedia[];
  mediaStorage: TripMediaStorage | null;
}

export interface TravelGuideDataSource {
  listTrips(): Promise<TripSummaryViewModel[]>;
  // ESLint's base no-unused-vars rule does not recognize interface method arguments.
  // eslint-disable-next-line no-unused-vars
  getTripContext(tripId: string): Promise<TripContextViewModel | null>;
  // eslint-disable-next-line no-unused-vars
  getToday(tripId: string): Promise<TodayViewModel | null>;
  // eslint-disable-next-line no-unused-vars
  getSchedule(tripId: string): Promise<ScheduleViewModel | null>;
  // eslint-disable-next-line no-unused-vars
  getMapPreview(tripId: string): Promise<MapPreviewViewModel | null>;
  // eslint-disable-next-line no-unused-vars
  getTools(tripId: string): Promise<ToolsViewModel | null>;
  // eslint-disable-next-line no-unused-vars
  getMedia?(tripId: string): Promise<TripMedia[]>;
  // eslint-disable-next-line no-unused-vars
  getMediaStorage?(tripId: string): Promise<TripMediaStorage | null>;
}

export interface MutableTravelGuideDataSource extends TravelGuideDataSource {
  // eslint-disable-next-line no-unused-vars
  invalidateTrip(tripId: string, minimumSyncVersion?: number): void;
}

export type TripWorkspaceResource =
  | { status: "loading"; reload: () => void }
  | { status: "ready"; data: TripWorkspace; reload: () => void }
  | { status: "empty"; retry: () => void; reload: () => void }
  | {
      status: "error";
      code?: string;
      message: string;
      retry: () => void;
      reload: () => void;
    };
