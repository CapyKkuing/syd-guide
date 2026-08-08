import type {
  EntityKind,
  EntityMap,
  PlaceCategory,
  PlaceStatus,
  VoteChoice,
} from "./entities";
import type { BookingDocument } from "./media";

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
    isRecommended?: boolean;
    isSaved?: boolean;
    provider?: "google-places" | null;
    providerPlaceId?: string | null;
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
    usageStatus?: "booked" | "check_in_pending" | "checked_in" | "used" | "cancelled";
    externalUrl: string | null;
    documentUrl: string | null;
    documentFile?: BookingDocument | null;
    memo: string;
    isFixed: boolean;
    isRequired: boolean;
  };
  check_item: {
    phase: "pretrip" | "travel";
    category?: "essential" | "reservation" | "packing" | "travel";
    scope: "shared" | "personal";
    ownerMemberId: string | null;
    assigneeMemberId: string | null;
    title: string;
    quantity: number;
    memo: string;
    requirementKind: "passport" | "essential" | null;
    isDone: boolean;
    position: number;
  };
  expense: {
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
  };
  settlement_transfer: {
    settlementGroupId: string;
    expenseIds: string[];
    currency: string;
    fromMemberId: string;
    toMemberId: string;
    amountMinor: number;
    status: "pending" | "completed";
    completedAt: string | null;
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

export interface ScheduleReorderRequest {
  idempotencyKey: string;
  entity: "schedule_item";
  action: "reorder";
  entityId: string;
  baseVersion: null;
  payload: {
    items: Array<{
      entityId: string;
      baseVersion: number;
      position: number;
    }>;
  };
}

export interface ScheduleReorderMutationSuccess {
  entity: "schedule_item";
  entityId: string;
  syncVersion: number;
  items: Array<{ entityId: string; version: number }>;
}

export interface SettlementGroupCreateRequest {
  idempotencyKey: string;
  entity: "settlement_transfer";
  action: "create_group";
  entityId: string;
  baseVersion: null;
  payload: {
    expenseIds: string[];
    currency: string;
    transfers: Array<{
      entityId: string;
      fromMemberId: string;
      toMemberId: string;
      amountMinor: number;
    }>;
  };
}

export interface SettlementGroupMutationSuccess extends MutationSuccess {
  entity: "settlement_transfer";
  transfers: Array<{ entityId: string; version: number }>;
}

export interface SettlementTransferCompleteRequest {
  idempotencyKey: string;
  entity: "settlement_transfer";
  action: "complete";
  entityId: string;
  baseVersion: number;
  payload: { settlementGroupId: string };
}

export type SyncMutationRequest =
  | MutationRequest
  | ScheduleReorderRequest
  | SettlementGroupCreateRequest
  | SettlementTransferCompleteRequest;
export type SyncMutationSuccess =
  | MutationSuccess
  | ScheduleReorderMutationSuccess
  | SettlementGroupMutationSuccess;

export function isScheduleReorderRequest(
  request: SyncMutationRequest
): request is ScheduleReorderRequest {
  return request.action === "reorder";
}

export function isSettlementGroupCreateRequest(
  request: SyncMutationRequest
): request is SettlementGroupCreateRequest {
  return request.action === "create_group";
}

export interface VersionConflict<K extends EntityKind = EntityKind> {
  code: "VERSION_CONFLICT";
  mutation: MutationRequest<K>;
  current: EntityMap[K];
}
