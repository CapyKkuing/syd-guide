import type {
  MutationPayloadMap,
  MutationRequest,
} from "../../src/shared/mutations";

export interface ReferenceGuard {
  sql: string;
  bindings: unknown[];
}

const valid: ReferenceGuard = { sql: "1 = 1", bindings: [] };
const invalid: ReferenceGuard = { sql: "0 = 1", bindings: [] };

function entity(
  table: "trip_days" | "schedule_items" | "places" | "bookings",
  entityId: string,
  tripId: string
): ReferenceGuard {
  return {
    sql: `EXISTS (
      SELECT 1 FROM ${table} reference
      WHERE reference.id = ? AND reference.trip_id = ?
    )`,
    bindings: [entityId, tripId],
  };
}

function optionalEntity(
  table: "places" | "bookings",
  entityId: string | null,
  tripId: string
): ReferenceGuard {
  return entityId === null ? valid : entity(table, entityId, tripId);
}

function member(memberId: string | null, tripId: string): ReferenceGuard {
  if (memberId === null) return valid;
  return {
    sql: `EXISTS (
      SELECT 1 FROM trip_members reference
      WHERE reference.member_id = ? AND reference.trip_id = ?
    )`,
    bindings: [memberId, tripId],
  };
}

function all(...guards: ReferenceGuard[]): ReferenceGuard {
  return {
    sql: guards.map((guard) => `(${guard.sql})`).join(" AND "),
    bindings: guards.flatMap((guard) => guard.bindings),
  };
}

function noteTarget(
  tripId: string,
  targetType: "trip" | "schedule_item" | "place" | "booking",
  targetId: string | null
): ReferenceGuard {
  if (targetType === "trip") {
    return targetId === null
      ? valid
      : { sql: "? = ?", bindings: [targetId, tripId] };
  }
  if (targetId === null) return invalid;
  const table = {
    schedule_item: "schedule_items",
    place: "places",
    booking: "bookings",
  } as const;
  return entity(table[targetType], targetId, tripId);
}

export function mutationReferenceGuard(
  tripId: string,
  mutation: MutationRequest
): ReferenceGuard {
  if (mutation.action === "delete" || mutation.payload === null) return valid;

  switch (mutation.entity) {
    case "trip_day":
      return valid;
    case "schedule_item": {
      const payload = mutation.payload as MutationPayloadMap["schedule_item"];
      return all(
        entity("trip_days", payload.tripDayId, tripId),
        optionalEntity("places", payload.placeId, tripId),
        optionalEntity("bookings", payload.bookingId, tripId)
      );
    }
    case "place":
      return member(
        (mutation.payload as MutationPayloadMap["place"]).savedBy,
        tripId
      );
    case "booking":
      return optionalEntity(
        "places",
        (mutation.payload as MutationPayloadMap["booking"]).placeId,
        tripId
      );
    case "check_item": {
      const payload = mutation.payload as MutationPayloadMap["check_item"];
      return all(
        payload.scope === "personal"
          ? valid
          : member(payload.ownerMemberId, tripId),
        member(payload.assigneeMemberId, tripId)
      );
    }
    case "expense": {
      const payload = mutation.payload as MutationPayloadMap["expense"];
      return all(
        member(payload.paidByMemberId, tripId),
        member(payload.personalForMemberId, tripId),
      );
    }
    case "settlement_transfer": {
      const payload = mutation.payload as MutationPayloadMap["settlement_transfer"];
      return all(
        member(payload.fromMemberId, tripId),
        member(payload.toMemberId, tripId),
      );
    }
    case "note": {
      const payload = mutation.payload as MutationPayloadMap["note"];
      return noteTarget(
        tripId,
        payload.targetType,
        payload.targetId
      );
    }
    case "vote": {
      const payload = mutation.payload as MutationPayloadMap["vote"];
      const table = payload.targetType === "place"
        ? "places"
        : "schedule_items";
      return entity(table, payload.targetId, tripId);
    }
  }
}
