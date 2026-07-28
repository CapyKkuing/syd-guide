import type {
  EntityKind,
  Principal,
} from "../../src/shared/entities";
import type {
  MutationPayloadMap,
  MutationRequest,
} from "../../src/shared/mutations";
import {
  entityRegistry,
  type EntityRegistryEntry,
} from "./entity-registry";
import { mutationReferenceGuard } from "./mutation-references";
import type { Env } from "../env";

function privacyClause(entity: EntityKind): string {
  if (entity === "check_item") {
    return "AND (scope = 'shared' OR owner_member_id = ?)";
  }
  if (entity === "note") {
    return "AND (visibility = 'shared' OR author_member_id = ?)";
  }
  if (entity === "vote") return "AND member_id = ?";
  return "";
}

function mutationStatement(
  env: Env,
  tripId: string,
  principal: Principal,
  mutation: MutationRequest,
  definition: EntityRegistryEntry,
  timestamp: string
): D1PreparedStatement {
  const privacy = privacyClause(mutation.entity);
  const reference = mutationReferenceGuard(tripId, mutation);
  if (mutation.action === "create") {
    const columns = definition.columns.join(", ");
    const placeholders = definition.columns.map(() => "?").join(", ");
    const values = definition.values(
      mutation.payload as MutationPayloadMap[EntityKind],
      principal
    );
    return env.DB.prepare(
      `INSERT INTO ${definition.table} (
        id, trip_id, ${columns}, version, updated_by, updated_at
      )
      SELECT ?, ?, ${placeholders}, 1, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM trip_members WHERE trip_id = ? AND member_id = ?
      ) AND (${reference.sql})`
    ).bind(
      mutation.entityId,
      tripId,
      ...values,
      principal.memberId,
      timestamp,
      tripId,
      principal.memberId,
      ...reference.bindings
    );
  }

  const version = mutation.baseVersion as number;
  if (mutation.action === "update") {
    const assignments = definition.columns
      .map((column) => `${column} = ?`)
      .join(", ");
    const values = definition.values(
      mutation.payload as MutationPayloadMap[EntityKind],
      principal
    );
    return env.DB.prepare(
      `UPDATE ${definition.table}
       SET ${assignments}, version = version + 1, updated_by = ?, updated_at = ?
       WHERE id = ? AND trip_id = ? AND version = ? ${privacy}
         AND EXISTS (
           SELECT 1 FROM trip_members
           WHERE trip_id = ? AND member_id = ?
         )
         AND (${reference.sql})`
    ).bind(
      ...values,
      principal.memberId,
      timestamp,
      mutation.entityId,
      tripId,
      version,
      ...(privacy ? [principal.memberId] : []),
      tripId,
      principal.memberId,
      ...reference.bindings
    );
  }

  return env.DB.prepare(
    `DELETE FROM ${definition.table}
     WHERE id = ? AND trip_id = ? AND version = ? ${privacy}
       AND EXISTS (
         SELECT 1 FROM trip_members
         WHERE trip_id = ? AND member_id = ?
       )`
  ).bind(
    mutation.entityId,
    tripId,
    version,
    ...(privacy ? [principal.memberId] : []),
    tripId,
    principal.memberId
  );
}

const activityNames: Record<EntityKind, string> = {
  trip_day: "여행 날짜",
  schedule_item: "일정",
  place: "장소",
  booking: "예약",
  check_item: "체크 항목",
  note: "메모",
  vote: "투표",
};

const actionNames = {
  create: "추가",
  update: "수정",
  delete: "삭제",
} as const;

export async function runMutationBatch(
  env: Env,
  tripId: string,
  principal: Principal,
  mutation: MutationRequest,
  timestamp: string
): Promise<boolean> {
  const definition = entityRegistry[mutation.entity];
  const nextVersion = mutation.action === "create"
    ? 1
    : (mutation.baseVersion as number) + 1;
  const summary = `${activityNames[mutation.entity]} ${actionNames[mutation.action]}`;
  const results = await env.DB.batch([
    mutationStatement(env, tripId, principal, mutation, definition, timestamp),
    env.DB.prepare(
      `UPDATE trips SET sync_version = sync_version + 1
       WHERE id = ? AND changes() = 1`
    ).bind(tripId),
    env.DB.prepare(
      `INSERT INTO activity_logs (
        id, trip_id, member_id, entity_type, entity_id, action, summary,
        created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`
    ).bind(
      crypto.randomUUID(),
      tripId,
      principal.memberId,
      mutation.entity,
      mutation.entityId,
      mutation.action,
      summary,
      timestamp
    ),
    env.DB.prepare(
      `INSERT INTO mutation_receipts (
        idempotency_key, trip_id, member_id, result_json, created_at
      )
      SELECT ?, ?, ?, json_object(
        'entity', ?, 'entityId', ?, 'version', ?,
        'syncVersion', (SELECT sync_version FROM trips WHERE id = ?)
      ), ? WHERE changes() = 1`
    ).bind(
      mutation.idempotencyKey,
      tripId,
      principal.memberId,
      mutation.entity,
      mutation.entityId,
      nextVersion,
      tripId,
      timestamp
    ),
  ]);
  return Number(results[0]?.meta.changes ?? 0) === 1
    && Number(results[3]?.meta.changes ?? 0) === 1;
}
