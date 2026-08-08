import type { Principal, Trip, TripStatus } from "../../src/shared/entities";
import {
  deriveJourneyBoundaries,
  flightDetailsSchema,
  type FlightDetails,
} from "../../src/shared/flights";
import type { Env } from "../env";

export interface TripInput {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  status: TripStatus;
  coverImageUrl: string | null;
  outboundFlight: FlightDetails | null;
  returnFlight: FlightDetails | null;
}

export type TripRow = {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  time_zone: string;
  status: TripStatus;
  cover_image_url: string | null;
  journey_starts_at: string | null;
  journey_ends_at: string | null;
  outbound_flight_json: string | null;
  return_flight_json: string | null;
  representative_media_id: string | null;
  version: number;
  sync_version: number;
  deleted_at: string | null;
  purge_after: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type TripSummaryRow = TripRow & {
  country: null;
  traveler_count: number;
  booking_count: number;
  schedule_item_count: number;
};

export interface TripListSummary extends Trip {
  country: null;
  travelerCount: number;
  bookingCount: number;
  scheduleItemCount: number;
}

export type TripMutationResult =
  | { ok: true; trip: Trip }
  | {
      ok: false;
      reason: "not-found" | "conflict" | "invalid-state" | "purge-expired";
      current?: Trip;
    };

export function toTrip(row: TripRow): Trip {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    timeZone: row.time_zone,
    status: row.status,
    coverImageUrl: row.cover_image_url,
    journeyStartsAt: row.journey_starts_at,
    journeyEndsAt: row.journey_ends_at,
    outboundFlight: parseFlight(row.outbound_flight_json),
    returnFlight: parseFlight(row.return_flight_json),
    representativeMediaId: row.representative_media_id,
    version: row.version,
    syncVersion: row.sync_version,
    deletedAt: row.deleted_at,
    purgeAfter: row.purge_after,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseFlight(value: string | null): FlightDetails | null {
  return value === null ? null : flightDetailsSchema.parse(JSON.parse(value));
}

function encodeFlight(value: FlightDetails | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

export function findTripForMemberStatement(
  env: Env,
  tripId: string,
  memberId: string
): D1PreparedStatement {
  return env.DB.prepare(
    `SELECT t.* FROM trips t
     INNER JOIN trip_members tm ON tm.trip_id = t.id
     WHERE t.id = ? AND tm.member_id = ?`
  ).bind(tripId, memberId);
}

export async function listTripsForMember(
  env: Env,
  memberId: string,
  view: "active" | "trash"
): Promise<TripListSummary[]> {
  const deletedClause =
    view === "active" ? "t.deleted_at IS NULL" : "t.deleted_at IS NOT NULL";
  const { results } = await env.DB.prepare(
    `SELECT t.*,
       NULL AS country,
       (SELECT COUNT(*) FROM trip_members counts WHERE counts.trip_id = t.id)
         AS traveler_count,
       (SELECT COUNT(*) FROM bookings counts WHERE counts.trip_id = t.id)
         AS booking_count,
       (SELECT COUNT(*) FROM schedule_items counts WHERE counts.trip_id = t.id)
         AS schedule_item_count
     FROM trips t
     INNER JOIN trip_members tm ON tm.trip_id = t.id
     WHERE tm.member_id = ? AND ${deletedClause}
     ORDER BY t.updated_at DESC, t.id ASC`
  )
    .bind(memberId)
    .all<TripSummaryRow>();
  return results.map((row) => ({
    ...toTrip(row),
    country: null,
    travelerCount: row.traveler_count,
    bookingCount: row.booking_count,
    scheduleItemCount: row.schedule_item_count,
  }));
}

export async function findTripForMember(
  env: Env,
  tripId: string,
  memberId: string
): Promise<Trip | null> {
  const row = await findTripForMemberStatement(env, tripId, memberId)
    .first<TripRow>();
  return row ? toTrip(row) : null;
}

export async function createTrip(
  env: Env,
  principal: Principal,
  input: TripInput,
  now: Date
): Promise<Trip> {
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  const boundary = deriveJourneyBoundaries(
    input.outboundFlight,
    input.returnFlight
  );
  const sharedChecklist = [
    ["해외 결제 수단", "essential", "pretrip", "essential"],
    ["여행자 보험·비상 연락처 확인", "essential", "pretrip", "essential"],
    ["항공권 확인", "reservation", "pretrip", null],
    ["숙소 예약 확인", "reservation", "pretrip", null],
    ["충전기", "packing", "pretrip", null],
    ["eSIM·로밍", "packing", "pretrip", null],
    ["오늘 쓴 비용 확인", "travel", "travel", null],
  ] as const;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO trips (
        id, title, destination, start_date, end_date, time_zone, status,
        cover_image_url, journey_starts_at, journey_ends_at, outbound_flight_json,
        return_flight_json, representative_media_id, version, sync_version,
        deleted_at, purge_after, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 0, NULL, NULL, ?, ?, ?, ?)`
    ).bind(
      id,
      input.title,
      input.destination,
      input.startDate,
      input.endDate,
      input.timeZone,
      input.status,
      input.coverImageUrl,
      boundary.journeyStartsAt,
      boundary.journeyEndsAt,
      encodeFlight(input.outboundFlight),
      encodeFlight(input.returnFlight),
      principal.memberId,
      principal.memberId,
      timestamp,
      timestamp
    ),
    env.DB.prepare(
      `INSERT INTO trip_members (trip_id, member_id, joined_at)
       SELECT ?, id, ? FROM members WHERE is_active = 1`
    ).bind(id, timestamp),
    env.DB.prepare(
      `INSERT INTO check_items (
        id, trip_id, scope, owner_member_id, assignee_member_id, title,
        quantity, memo, is_done, position, version, updated_by, updated_at,
        phase, category, requirement_kind
      )
      SELECT lower(hex(randomblob(16))), ?, 'personal', id, id, '여권',
        1, '여권 만료일과 영문 이름을 확인하세요.', 0, 0, 1, ?, ?,
        'pretrip', 'essential', 'passport'
      FROM members WHERE is_active = 1`
    ).bind(id, principal.memberId, timestamp),
    ...sharedChecklist.map(([title, category, phase, requirementKind], index) => (
      env.DB.prepare(
        `INSERT INTO check_items (
          id, trip_id, scope, owner_member_id, assignee_member_id, title,
          quantity, memo, is_done, position, version, updated_by, updated_at,
          phase, category, requirement_kind
        ) VALUES (?, ?, 'shared', NULL, NULL, ?, 1, '', 0, ?, 1, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        id,
        title,
        index + 1,
        principal.memberId,
        timestamp,
        phase,
        category,
        requirementKind
      )
    )),
  ]);
  const trip = await findTripForMember(env, id, principal.memberId);
  if (!trip) throw new Error("Created trip could not be loaded");
  return trip;
}

async function failedMutation(
  env: Env,
  tripId: string,
  memberId: string
): Promise<TripMutationResult> {
  const current = await findTripForMember(env, tripId, memberId);
  return current
    ? { ok: false, reason: "conflict", current }
    : { ok: false, reason: "not-found" };
}

export async function updateTrip(
  env: Env,
  principal: Principal,
  tripId: string,
  input: TripInput,
  baseVersion: number,
  now: Date
): Promise<TripMutationResult> {
  const current = await findTripForMember(env, tripId, principal.memberId);
  if (!current) return { ok: false, reason: "not-found" };
  if (current.version !== baseVersion) {
    return { ok: false, reason: "conflict", current };
  }
  if (current.deletedAt) {
    return { ok: false, reason: "invalid-state", current };
  }
  const derivedBoundary = deriveJourneyBoundaries(
    input.outboundFlight,
    input.returnFlight
  );
  const updated = await env.DB.prepare(
    `UPDATE trips SET
      title = ?, destination = ?, start_date = ?, end_date = ?, time_zone = ?,
      status = ?, cover_image_url = ?, journey_starts_at = ?, journey_ends_at = ?,
      outbound_flight_json = ?, return_flight_json = ?, version = version + 1,
      updated_by = ?, updated_at = ?
     WHERE id = ? AND version = ? AND deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM trip_members
         WHERE trip_id = trips.id AND member_id = ?
       )
     RETURNING *`
  )
    .bind(
      input.title,
      input.destination,
      input.startDate,
      input.endDate,
      input.timeZone,
      input.status,
      input.coverImageUrl,
      derivedBoundary.journeyStartsAt,
      derivedBoundary.journeyEndsAt,
      encodeFlight(input.outboundFlight),
      encodeFlight(input.returnFlight),
      principal.memberId,
      now.toISOString(),
      tripId,
      baseVersion,
      principal.memberId
    )
    .first<TripRow>();
  if (!updated) {
    return failedMutation(env, tripId, principal.memberId);
  }
  return { ok: true, trip: toTrip(updated) };
}

export async function trashTrip(
  env: Env,
  principal: Principal,
  tripId: string,
  baseVersion: number,
  now: Date
): Promise<TripMutationResult> {
  const current = await findTripForMember(env, tripId, principal.memberId);
  if (!current) return { ok: false, reason: "not-found" };
  if (current.version !== baseVersion) {
    return { ok: false, reason: "conflict", current };
  }
  if (current.deletedAt) {
    return { ok: false, reason: "invalid-state", current };
  }
  const deletedAt = now.toISOString();
  const purgeAfter = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const trashed = await env.DB.prepare(
    `UPDATE trips SET deleted_at = ?, purge_after = ?,
       version = version + 1, updated_by = ?, updated_at = ?
     WHERE id = ? AND version = ? AND deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM trip_members
         WHERE trip_id = trips.id AND member_id = ?
       )
     RETURNING *`
  )
    .bind(
      deletedAt,
      purgeAfter,
      principal.memberId,
      deletedAt,
      tripId,
      baseVersion,
      principal.memberId
    )
    .first<TripRow>();
  if (!trashed) {
    return failedMutation(env, tripId, principal.memberId);
  }
  return { ok: true, trip: toTrip(trashed) };
}

export async function restoreTrip(
  env: Env,
  principal: Principal,
  tripId: string,
  baseVersion: number,
  now: Date
): Promise<TripMutationResult> {
  const current = await findTripForMember(env, tripId, principal.memberId);
  if (!current) return { ok: false, reason: "not-found" };
  if (current.version !== baseVersion) {
    return { ok: false, reason: "conflict", current };
  }
  if (!current.deletedAt || !current.purgeAfter) {
    return { ok: false, reason: "invalid-state", current };
  }
  const purgeTime = Date.parse(current.purgeAfter);
  if (!Number.isFinite(purgeTime) || purgeTime <= now.getTime()) {
    return { ok: false, reason: "purge-expired", current };
  }
  const restored = await env.DB.prepare(
    `UPDATE trips SET deleted_at = NULL, purge_after = NULL,
       version = version + 1, updated_by = ?, updated_at = ?
     WHERE id = ? AND version = ? AND deleted_at IS NOT NULL
       AND purge_after > ?
       AND EXISTS (
         SELECT 1 FROM trip_members
         WHERE trip_id = trips.id AND member_id = ?
       )
     RETURNING *`
  )
    .bind(
      principal.memberId,
      now.toISOString(),
      tripId,
      baseVersion,
      now.toISOString(),
      principal.memberId
    )
    .first<TripRow>();
  if (!restored) {
    return failedMutation(env, tripId, principal.memberId);
  }
  return { ok: true, trip: toTrip(restored) };
}
