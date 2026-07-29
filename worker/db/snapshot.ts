import type { TripSnapshot } from "../../src/shared/api";
import type { ActivityLog, PublicMember } from "../../src/shared/entities";
import type { Env } from "../env";
import { entityRegistry } from "./entity-registry";
import {
  findTripForMemberStatement,
  toTrip,
  type TripRow,
} from "./trips";

type Row = Record<string, unknown>;

function publicMember(row: Row): PublicMember {
  return {
    id: String(row.id),
    role: row.role as PublicMember["role"],
    displayName: String(row.display_name),
  };
}

function activity(row: Row): ActivityLog {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    memberId: String(row.member_id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    action: String(row.action),
    summary: String(row.summary),
    createdAt: String(row.created_at),
  };
}

function statement(
  env: Env,
  sql: string,
  ...bindings: unknown[]
): D1PreparedStatement {
  return env.DB.prepare(sql).bind(...bindings);
}

export async function loadTripSnapshot(
  env: Env,
  tripId: string,
  memberId: string
): Promise<TripSnapshot | null> {
  const results = await env.DB.batch<Row>([
    findTripForMemberStatement(env, tripId, memberId),
    statement(
      env,
      `SELECT m.id, m.role, m.display_name
       FROM members m
       INNER JOIN trip_members tm ON tm.member_id = m.id
       WHERE tm.trip_id = ?
       ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, m.id`,
      tripId
    ),
    statement(
      env,
      "SELECT * FROM trip_days WHERE trip_id = ? ORDER BY position, id",
      tripId
    ),
    statement(
      env,
      `SELECT * FROM schedule_items
       WHERE trip_id = ? ORDER BY trip_day_id, position, id`,
      tripId
    ),
    statement(env, "SELECT * FROM places WHERE trip_id = ? ORDER BY id", tripId),
    statement(
      env,
      "SELECT * FROM bookings WHERE trip_id = ? ORDER BY starts_at, id",
      tripId
    ),
    statement(
      env,
      `SELECT * FROM check_items
       WHERE trip_id = ?
         AND (scope = 'shared' OR owner_member_id = ?)
       ORDER BY position, id`,
      tripId,
      memberId
    ),
    statement(
      env,
      "SELECT * FROM expenses WHERE trip_id = ? ORDER BY spent_on DESC, id",
      tripId
    ),
    statement(
      env,
      `SELECT * FROM notes
       WHERE trip_id = ?
         AND (visibility = 'shared' OR author_member_id = ?)
       ORDER BY CASE visibility WHEN 'shared' THEN 0 ELSE 1 END, id`,
      tripId,
      memberId
    ),
    statement(
      env,
      `SELECT * FROM votes
       WHERE trip_id = ? ORDER BY target_type, target_id, member_id`,
      tripId
    ),
    statement(
      env,
      `SELECT a.* FROM activity_logs a
       WHERE a.trip_id = ?
         AND (
           a.entity_type NOT IN ('check_item', 'note')
           OR (
             a.entity_type = 'check_item'
             AND (
               EXISTS (
                 SELECT 1 FROM check_items c
                 WHERE c.id = a.entity_id
                   AND (c.scope = 'shared' OR c.owner_member_id = ?)
               )
               OR (
                 NOT EXISTS (SELECT 1 FROM check_items c WHERE c.id = a.entity_id)
                 AND a.member_id = ?
               )
             )
           )
           OR (
             a.entity_type = 'note'
             AND (
               EXISTS (
                 SELECT 1 FROM notes n
                 WHERE n.id = a.entity_id
                   AND (n.visibility = 'shared' OR n.author_member_id = ?)
               )
               OR (
                 NOT EXISTS (SELECT 1 FROM notes n WHERE n.id = a.entity_id)
                 AND a.member_id = ?
               )
             )
           )
         )
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 100`,
      tripId,
      memberId,
      memberId,
      memberId,
      memberId
    ),
  ]);
  const tripRow = results[0]?.results[0] as TripRow | undefined;
  if (!tripRow) return null;
  const trip = toTrip(tripRow);
  const [
    ,
    memberRows,
    dayRows,
    scheduleRows,
    placeRows,
    bookingRows,
    checkRows,
    expenseRows,
    noteRows,
    voteRows,
    activityRows,
  ] = results.map((result) => result.results);

  return {
    trip,
    members: memberRows.map(publicMember),
    days: dayRows.map((row) => entityRegistry.trip_day.parse(row)),
    scheduleItems: scheduleRows.map(
      (row) => entityRegistry.schedule_item.parse(row)
    ),
    places: placeRows.map((row) => entityRegistry.place.parse(row)),
    bookings: bookingRows.map((row) => entityRegistry.booking.parse(row)),
    checkItems: checkRows.map((row) => entityRegistry.check_item.parse(row)),
    expenses: expenseRows.map((row) => entityRegistry.expense.parse(row)),
    notes: noteRows.map((row) => entityRegistry.note.parse(row)),
    votes: voteRows.map((row) => entityRegistry.vote.parse(row)),
    activity: activityRows.map(activity),
    syncVersion: trip.syncVersion,
  } as TripSnapshot;
}
