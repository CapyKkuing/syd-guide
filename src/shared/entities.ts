import type { FlightDetails } from "./flights";

export type MemberRole = "owner" | "partner";
export type TripStatus = "upcoming" | "active" | "completed";
export type PlaceCategory =
  | "restaurant"
  | "cafe"
  | "attraction"
  | "lodging"
  | "transport";
export type PlaceStatus = "saved" | "maybe" | "visited";
export type VoteChoice = "must" | "okay" | "skip";
export type EntityKind =
  | "trip_day"
  | "schedule_item"
  | "place"
  | "booking"
  | "check_item"
  | "expense"
  | "note"
  | "vote";

export interface Principal {
  memberId: string;
  role: MemberRole;
  sessionId?: string;
}

export interface VersionedEntity {
  id: string;
  tripId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PublicMember {
  id: string;
  role: MemberRole;
  displayName: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  status: TripStatus;
  coverImageUrl: string | null;
  journeyStartsAt: string | null;
  journeyEndsAt: string | null;
  outboundFlight: FlightDetails | null;
  returnFlight: FlightDetails | null;
  representativeMediaId: string | null;
  version: number;
  syncVersion: number;
  deletedAt: string | null;
  purgeAfter: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripDay extends VersionedEntity {
  dayDate: string;
  title: string;
  position: number;
}

export interface ScheduleItem extends VersionedEntity {
  tripDayId: string;
  placeId: string | null;
  bookingId: string | null;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  memo: string;
  travelMode: "walk" | "transit" | "drive" | "ferry" | "other" | null;
  travelNote: string;
  position: number;
  isFixed: boolean;
  isDone: boolean;
}

export interface Place extends VersionedEntity {
  name: string;
  category: PlaceCategory;
  status: PlaceStatus;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  description: string;
  savedBy: string | null;
}

export interface Booking extends VersionedEntity {
  placeId: string | null;
  bookingType:
    | "flight"
    | "lodging"
    | "ticket"
    | "tour"
    | "transport"
    | "restaurant"
    | "other";
  provider: string;
  startsAt: string;
  endsAt: string | null;
  reservationCode: string | null;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
  externalUrl: string | null;
  documentUrl: string | null;
  memo: string;
  isFixed: boolean;
  isRequired: boolean;
}

export type CheckItemCategory = "essential" | "reservation" | "packing" | "travel";

export interface CheckItem extends VersionedEntity {
  phase: "pretrip" | "travel";
  category: CheckItemCategory;
  scope: "shared" | "personal";
  ownerMemberId: string | null;
  assigneeMemberId: string | null;
  title: string;
  quantity: number;
  memo: string;
  requirementKind: "passport" | "essential" | null;
  isDone: boolean;
  position: number;
}

export interface Expense extends VersionedEntity {
  phase: "pretrip" | "travel";
  category:
    | "flight"
    | "lodging"
    | "reservation"
    | "food"
    | "transport"
    | "shopping"
    | "activity"
    | "other";
  customCategory: string | null;
  title: string;
  amountMinor: number;
  currency: string;
  spentOn: string;
  paidByMemberId: string;
  expenseScope: "shared" | "personal" | null;
  personalForMemberId: string | null;
  paymentMethod: "cash" | "card" | null;
  isSettled: boolean;
  memo: string;
}

export interface Note extends VersionedEntity {
  targetType: "trip" | "schedule_item" | "place" | "booking";
  targetId: string | null;
  visibility: "shared" | "personal";
  authorMemberId: string;
  body: string;
  attachmentUrl: string | null;
}

export interface Vote extends VersionedEntity {
  targetType: "place" | "schedule_item";
  targetId: string;
  memberId: string;
  choice: VoteChoice;
}

export interface ActivityLog {
  id: string;
  tripId: string;
  memberId: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
}

export interface EntityMap {
  trip_day: TripDay;
  schedule_item: ScheduleItem;
  place: Place;
  booking: Booking;
  check_item: CheckItem;
  expense: Expense;
  note: Note;
  vote: Vote;
}
