import { z } from "zod";
import type {
  EntityKind,
  EntityMap,
  Principal,
  VersionedEntity,
} from "../../src/shared/entities";
import type { MutationPayloadMap } from "../../src/shared/mutations";
import { entitySchemas } from "./entity-schemas";

export { idSchema } from "./entity-schemas";

type Row = Record<string, unknown>;
type Payload = MutationPayloadMap[EntityKind];

export interface EntityRegistryEntry {
  table: string;
  columns: readonly string[];
  payloadSchema: z.ZodType;
  values: (payload: Payload, principal: Principal) => unknown[];
  parse: (row: Row) => EntityMap[EntityKind];
}

function base(row: Row): VersionedEntity {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    version: Number(row.version),
    updatedAt: String(row.updated_at),
    updatedBy: String(row.updated_by),
  };
}

const bool = (value: unknown) => Boolean(value);

export const entityRegistry = {
  trip_day: {
    table: "trip_days",
    columns: ["day_date", "title", "position"],
    payloadSchema: entitySchemas.trip_day,
    values: (raw) => {
      const value = raw as MutationPayloadMap["trip_day"];
      return [value.dayDate, value.title, value.position];
    },
    parse: (row) => ({
      ...base(row),
      dayDate: String(row.day_date),
      title: String(row.title),
      position: Number(row.position),
    }),
  },
  schedule_item: {
    table: "schedule_items",
    columns: [
      "trip_day_id", "place_id", "booking_id", "title", "starts_at", "ends_at",
      "memo", "travel_mode", "travel_note", "position", "is_fixed", "is_done",
    ],
    payloadSchema: entitySchemas.schedule_item,
    values: (raw) => {
      const value = raw as MutationPayloadMap["schedule_item"];
      return [
        value.tripDayId, value.placeId, value.bookingId, value.title,
        value.startsAt, value.endsAt, value.memo, value.travelMode,
        value.travelNote, value.position, Number(value.isFixed),
        Number(value.isDone),
      ];
    },
    parse: (row) => ({
      ...base(row),
      tripDayId: String(row.trip_day_id),
      placeId: row.place_id === null ? null : String(row.place_id),
      bookingId: row.booking_id === null ? null : String(row.booking_id),
      title: String(row.title),
      startsAt: row.starts_at === null ? null : String(row.starts_at),
      endsAt: row.ends_at === null ? null : String(row.ends_at),
      memo: String(row.memo),
      travelMode: row.travel_mode as EntityMap["schedule_item"]["travelMode"],
      travelNote: String(row.travel_note),
      position: Number(row.position),
      isFixed: bool(row.is_fixed),
      isDone: bool(row.is_done),
    }),
  },
  place: {
    table: "places",
    columns: [
      "name", "category", "status", "address", "latitude", "longitude",
      "map_url", "source_url", "image_url", "description", "saved_by",
    ],
    payloadSchema: entitySchemas.place,
    values: (raw) => {
      const value = raw as MutationPayloadMap["place"];
      return [
        value.name, value.category, value.status, value.address, value.latitude,
        value.longitude, value.mapUrl, value.sourceUrl, value.imageUrl,
        value.description, value.savedBy,
      ];
    },
    parse: (row) => ({
      ...base(row),
      name: String(row.name),
      category: row.category as EntityMap["place"]["category"],
      status: row.status as EntityMap["place"]["status"],
      address: row.address === null ? null : String(row.address),
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      mapUrl: row.map_url === null ? null : String(row.map_url),
      sourceUrl: row.source_url === null ? null : String(row.source_url),
      imageUrl: row.image_url === null ? null : String(row.image_url),
      description: String(row.description),
      savedBy: row.saved_by === null ? null : String(row.saved_by),
    }),
  },
  booking: {
    table: "bookings",
    columns: [
      "place_id", "booking_type", "provider", "starts_at", "ends_at",
      "reservation_code", "payment_status", "external_url", "document_url",
      "memo", "is_fixed", "is_required",
    ],
    payloadSchema: entitySchemas.booking,
    values: (raw) => {
      const value = raw as MutationPayloadMap["booking"];
      return [
        value.placeId, value.bookingType, value.provider, value.startsAt,
        value.endsAt, value.reservationCode, value.paymentStatus,
        value.externalUrl, value.documentUrl, value.memo, Number(value.isFixed),
        Number(value.isRequired),
      ];
    },
    parse: (row) => ({
      ...base(row),
      placeId: row.place_id === null ? null : String(row.place_id),
      bookingType: row.booking_type as EntityMap["booking"]["bookingType"],
      provider: String(row.provider),
      startsAt: String(row.starts_at),
      endsAt: row.ends_at === null ? null : String(row.ends_at),
      reservationCode: row.reservation_code === null
        ? null : String(row.reservation_code),
      paymentStatus: row.payment_status as EntityMap["booking"]["paymentStatus"],
      externalUrl: row.external_url === null ? null : String(row.external_url),
      documentUrl: row.document_url === null ? null : String(row.document_url),
      memo: String(row.memo),
      isFixed: bool(row.is_fixed),
      isRequired: bool(row.is_required),
    }),
  },
  check_item: {
    table: "check_items",
    columns: [
      "phase", "scope", "owner_member_id", "assignee_member_id", "title", "quantity",
      "memo", "requirement_kind", "is_done", "position",
    ],
    payloadSchema: entitySchemas.check_item,
    values: (raw, principal) => {
      const value = raw as MutationPayloadMap["check_item"];
      return [
        value.phase,
        value.scope,
        value.scope === "personal" ? principal.memberId : value.ownerMemberId,
        value.assigneeMemberId, value.title, value.quantity, value.memo,
        value.requirementKind, Number(value.isDone), value.position,
      ];
    },
    parse: (row) => ({
      ...base(row),
      phase: row.phase as EntityMap["check_item"]["phase"],
      scope: row.scope as EntityMap["check_item"]["scope"],
      ownerMemberId: row.owner_member_id === null
        ? null : String(row.owner_member_id),
      assigneeMemberId: row.assignee_member_id === null
        ? null : String(row.assignee_member_id),
      title: String(row.title),
      quantity: Number(row.quantity),
      memo: String(row.memo),
      requirementKind: row.requirement_kind === null
        ? null
        : row.requirement_kind as EntityMap["check_item"]["requirementKind"],
      isDone: bool(row.is_done),
      position: Number(row.position),
    }),
  },
  expense: {
    table: "expenses",
    columns: [
      "phase", "category", "title", "amount_minor", "currency", "spent_on",
      "paid_by_member_id", "is_settled", "memo",
    ],
    payloadSchema: entitySchemas.expense,
    values: (raw) => {
      const value = raw as MutationPayloadMap["expense"];
      return [
        value.phase, value.category, value.title, value.amountMinor, value.currency,
        value.spentOn, value.paidByMemberId, Number(value.isSettled), value.memo,
      ];
    },
    parse: (row) => ({
      ...base(row),
      phase: row.phase as EntityMap["expense"]["phase"],
      category: row.category as EntityMap["expense"]["category"],
      title: String(row.title),
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency),
      spentOn: String(row.spent_on),
      paidByMemberId: String(row.paid_by_member_id),
      isSettled: bool(row.is_settled),
      memo: String(row.memo),
    }),
  },
  note: {
    table: "notes",
    columns: [
      "target_type", "target_id", "visibility", "author_member_id", "body",
      "attachment_url",
    ],
    payloadSchema: entitySchemas.note,
    values: (raw, principal) => {
      const value = raw as MutationPayloadMap["note"];
      return [
        value.targetType, value.targetId, value.visibility, principal.memberId,
        value.body, value.attachmentUrl,
      ];
    },
    parse: (row) => ({
      ...base(row),
      targetType: row.target_type as EntityMap["note"]["targetType"],
      targetId: row.target_id === null ? null : String(row.target_id),
      visibility: row.visibility as EntityMap["note"]["visibility"],
      authorMemberId: String(row.author_member_id),
      body: String(row.body),
      attachmentUrl: row.attachment_url === null
        ? null : String(row.attachment_url),
    }),
  },
  vote: {
    table: "votes",
    columns: ["target_type", "target_id", "member_id", "choice"],
    payloadSchema: entitySchemas.vote,
    values: (raw, principal) => {
      const value = raw as MutationPayloadMap["vote"];
      return [value.targetType, value.targetId, principal.memberId, value.choice];
    },
    parse: (row) => ({
      ...base(row),
      targetType: row.target_type as EntityMap["vote"]["targetType"],
      targetId: String(row.target_id),
      memberId: String(row.member_id),
      choice: row.choice as EntityMap["vote"]["choice"],
    }),
  },
} satisfies Record<EntityKind, EntityRegistryEntry>;
