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
  coverImageUrl: string;
  travelerCount: number;
  bookingCount: number;
  updatedAt: string;
}

export interface TripContextViewModel {
  trip: TripSummaryViewModel;
  trips: TripSummaryViewModel[];
  localDate: string;
  dayLabel: string;
  viewer: {
    displayName: string;
    role: "owner" | "partner";
  };
  partnerStatus: "connected" | "not-connected";
}

export interface ScheduleItemView {
  id: string;
  startsAt: string;
  endsAt: string | null;
  title: string;
  place: string;
  description: string;
  kind: ScheduleKind;
  travelMode: "walk" | "transit" | "drive" | "ferry" | null;
  travelNote: string | null;
  bookingStatus: "confirmed" | "pending" | null;
  isDone: boolean;
  mapUrl: string | null;
}

export interface ScheduleDayView {
  date: string;
  dayLabel: string;
  headline: string;
  items: ScheduleItemView[];
}

export interface TodayViewModel {
  phase: TripPhase;
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
    place: string;
    time: string;
    type: string;
    status: "confirmed" | "pending";
  } | null;
  budget: {
    spentAud: number;
    limitAud: number;
    isSample: true;
  };
  schedule: ScheduleItemView[];
  summary: {
    visitedPlaceCount: number;
    completedItemCount: number;
  } | null;
}

export interface MapPlaceView {
  id: string;
  name: string;
  category: "restaurant" | "cafe" | "attraction" | "lodging" | "transport";
  status: "saved" | "maybe" | "visited";
  dayDate: string;
  x: number;
  y: number;
  address: string;
  mapUrl: string | null;
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
  title: "Travel Essentials" | "Places" | "Planning & Settings";
  items: ToolItemView[];
}

export interface ToolsViewModel {
  groups: ToolGroupView[];
}

export interface TripWorkspace {
  context: TripContextViewModel;
  today: TodayViewModel;
  schedule: ScheduleViewModel;
  mapPreview: MapPreviewViewModel;
  tools: ToolsViewModel;
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
}
