import type {
  EntityKind,
  EntityMap,
  PlaceCategory,
  PlaceStatus,
  VoteChoice,
} from "./entities";

export interface MutationPayloadMap {
  trip_day: {
    dayDate: string;
    title: string;
    position: number;
  };
  schedule_item: {
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
  };
  place: {
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
  };
  booking: {
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
  };
  check_item: {
    scope: "shared" | "personal";
    ownerMemberId: string | null;
    assigneeMemberId: string | null;
    title: string;
    quantity: number;
    memo: string;
    isDone: boolean;
    position: number;
  };
  note: {
    targetType: "trip" | "schedule_item" | "place" | "booking";
    targetId: string | null;
    visibility: "shared" | "personal";
    body: string;
    attachmentUrl: string | null;
  };
  vote: {
    targetType: "place" | "schedule_item";
    targetId: string;
    choice: VoteChoice;
  };
}

export interface MutationRequest<K extends EntityKind = EntityKind> {
  idempotencyKey: string;
  entity: K;
  action: "create" | "update" | "delete";
  entityId: string;
  baseVersion: number | null;
  payload: MutationPayloadMap[K] | null;
}

export interface MutationSuccess {
  entity: EntityKind;
  entityId: string;
  version: number;
  syncVersion: number;
}

export interface VersionConflict<K extends EntityKind = EntityKind> {
  code: "VERSION_CONFLICT";
  mutation: MutationRequest<K>;
  current: EntityMap[K];
}
