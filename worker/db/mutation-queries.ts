import type {
  EntityKind,
  EntityMap,
  Principal,
} from "../../src/shared/entities";
import type { MutationRequest } from "../../src/shared/mutations";
import { entityRegistry } from "./entity-registry";
import { mutationReferenceGuard } from "./mutation-references";
import type { Env } from "../env";

type Row = Record<string, unknown>;

export type ReceiptRow = {
  trip_id: string;
  member_id: string;
  result_json: string;
};

export interface MutationReadQueries {
  hasMembership(
    env: Env,
    tripId: string,
    memberId: string
  ): Promise<boolean>;
  findReceipt(env: Env, key: string): Promise<ReceiptRow | null>;
  referencesAreValid(
    env: Env,
    tripId: string,
    mutation: MutationRequest
  ): Promise<boolean>;
  findCurrentEntity<K extends EntityKind>(
    env: Env,
    tripId: string,
    principal: Principal,
    entity: K,
    entityId: string
  ): Promise<EntityMap[K] | null>;
}

async function hasMembership(
  env: Env,
  tripId: string,
  memberId: string
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT t.sync_version FROM trips t
     INNER JOIN trip_members tm ON tm.trip_id = t.id
     WHERE t.id = ? AND tm.member_id = ?`
  ).bind(tripId, memberId).first();
  return row !== null;
}

function findReceipt(
  env: Env,
  key: string
): Promise<ReceiptRow | null> {
  return env.DB.prepare(
    `SELECT trip_id, member_id, result_json
     FROM mutation_receipts WHERE idempotency_key = ?`
  ).bind(key).first<ReceiptRow>();
}

async function referencesAreValid(
  env: Env,
  tripId: string,
  mutation: MutationRequest
): Promise<boolean> {
  const guard = mutationReferenceGuard(tripId, mutation);
  const result = await env.DB.prepare(
    `SELECT CASE WHEN (${guard.sql}) THEN 1 ELSE 0 END AS valid`
  ).bind(...guard.bindings).first<{ valid: number }>();
  return result?.valid === 1;
}

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

async function findCurrentEntity<K extends EntityKind>(
  env: Env,
  tripId: string,
  principal: Principal,
  entity: K,
  entityId: string
): Promise<EntityMap[K] | null> {
  const definition = entityRegistry[entity];
  const privacy = privacyClause(entity);
  const statement = env.DB.prepare(
    `SELECT * FROM ${definition.table}
     WHERE id = ? AND trip_id = ? ${privacy}
       AND EXISTS (
         SELECT 1 FROM trip_members
         WHERE trip_id = ? AND member_id = ?
       )`
  ).bind(
    entityId,
    tripId,
    ...(privacy ? [principal.memberId] : []),
    tripId,
    principal.memberId
  );
  const row = await statement.first<Row>();
  return row ? definition.parse(row) as EntityMap[K] : null;
}

export const mutationQueries = {
  hasMembership,
  findReceipt,
  referencesAreValid,
  findCurrentEntity,
} satisfies MutationReadQueries;
