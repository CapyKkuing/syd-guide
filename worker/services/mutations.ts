import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { Principal } from "../../src/shared/entities";
import type {
  MutationRequest,
  MutationSuccess,
  ScheduleReorderMutationSuccess,
  ScheduleReorderRequest,
  SettlementGroupCreateRequest,
  SettlementGroupMutationSuccess,
  SettlementTransferCompleteRequest,
  SyncMutationSuccess,
} from "../../src/shared/mutations";
import { entityRegistry, idSchema } from "../db/entity-registry";
import {
  mutationQueries,
  type ReceiptRow,
} from "../db/mutation-queries";
import {
  runMutationBatch,
  runScheduleReorderBatch,
  runSettlementGroupBatch,
  runSettlementTransferCompleteBatch,
} from "../db/mutation-store";
import type { Env } from "../env";

export class MutationError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

const envelopeSchema = z.object({
  idempotencyKey: idSchema,
  entity: z.enum([
    "trip_day",
    "schedule_item",
    "place",
    "booking",
    "check_item",
    "expense",
    "settlement_transfer",
    "note",
    "vote",
  ]),
  action: z.enum(["create", "update", "delete"]),
  entityId: idSchema,
  baseVersion: z.number().int().positive().nullable(),
  payload: z.unknown().nullable(),
});

const settlementGroupSchema = z.object({
  idempotencyKey: idSchema,
  entity: z.literal("settlement_transfer"),
  action: z.literal("create_group"),
  entityId: idSchema,
  baseVersion: z.null(),
  payload: z.object({
    expenseIds: z.array(idSchema).min(1).max(200),
    currency: z.string().regex(/^[A-Z]{3}$/),
    transfers: z.array(z.object({
      entityId: idSchema,
      fromMemberId: idSchema,
      toMemberId: idSchema,
      amountMinor: z.number().int().positive(),
    })).min(1).max(50),
  }),
});

const scheduleReorderSchema = z.object({
  idempotencyKey: idSchema,
  entity: z.literal("schedule_item"),
  action: z.literal("reorder"),
  entityId: idSchema,
  baseVersion: z.null(),
  payload: z.object({
    items: z.array(z.object({
      entityId: idSchema,
      baseVersion: z.number().int().positive(),
      position: z.number().int().nonnegative(),
    })).min(1).max(200),
  }),
});

const settlementCompleteSchema = z.object({
  idempotencyKey: idSchema,
  entity: z.literal("settlement_transfer"),
  action: z.literal("complete"),
  entityId: idSchema,
  baseVersion: z.number().int().positive(),
  payload: z.object({ settlementGroupId: idSchema }),
});

function parseSettlementGroup(input: unknown): SettlementGroupCreateRequest {
  const parsed = settlementGroupSchema.safeParse(input);
  if (!parsed.success) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "정산 묶음 요청이 올바르지 않습니다."
    );
  }
  const mutation = parsed.data;
  const expenseIds = new Set(mutation.payload.expenseIds);
  const transferIds = new Set(
    mutation.payload.transfers.map((transfer) => transfer.entityId)
  );
  if (
    expenseIds.size !== mutation.payload.expenseIds.length
    || transferIds.size !== mutation.payload.transfers.length
    || mutation.payload.transfers.some(
      (transfer) => transfer.fromMemberId === transfer.toMemberId
    )
  ) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "정산 묶음 요청이 올바르지 않습니다."
    );
  }
  return mutation;
}

function parseSettlementComplete(input: unknown): SettlementTransferCompleteRequest {
  const parsed = settlementCompleteSchema.safeParse(input);
  if (!parsed.success) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "송금 완료 요청이 올바르지 않습니다."
    );
  }
  return parsed.data;
}

function parseScheduleReorder(input: unknown): ScheduleReorderRequest {
  const parsed = scheduleReorderSchema.safeParse(input);
  if (!parsed.success) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "일정 순서 변경 요청이 올바르지 않습니다."
    );
  }
  const mutation = parsed.data;
  const entityIds = new Set(mutation.payload.items.map((item) => item.entityId));
  const positions = new Set(mutation.payload.items.map((item) => item.position));
  if (
    entityIds.size !== mutation.payload.items.length
    || positions.size !== mutation.payload.items.length
  ) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "일정 순서 변경 요청이 올바르지 않습니다."
    );
  }
  return mutation;
}

export function parseMutation(input: unknown): MutationRequest {
  const envelope = envelopeSchema.safeParse(input);
  if (!envelope.success) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "변경 요청이 올바르지 않습니다."
    );
  }
  const value = envelope.data;
  const create = value.action === "create";
  const deleteAction = value.action === "delete";
  if (
    (create && value.baseVersion !== null)
    || (!create && value.baseVersion === null)
    || (deleteAction && value.payload !== null)
    || (!deleteAction && value.payload === null)
  ) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "변경 요청이 올바르지 않습니다."
    );
  }
  const definition = entityRegistry[value.entity];
  const payload = deleteAction
    ? null
    : definition.payloadSchema.safeParse(value.payload);
  if (payload !== null && !payload.success) {
    throw new MutationError(
      400,
      "MUTATION_INPUT_INVALID",
      "변경 요청이 올바르지 않습니다.",
      { issues: payload.error.issues }
    );
  }
  return {
    ...value,
    payload: payload === null ? null : payload.data,
  } as MutationRequest;
}

function receiptResult(
  row: ReceiptRow,
  tripId: string,
  memberId: string
): SyncMutationSuccess {
  if (row.trip_id !== tripId || row.member_id !== memberId) {
    throw new MutationError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "이미 다른 변경에 사용된 멱등 키입니다."
    );
  }
  try {
    return JSON.parse(row.result_json) as SyncMutationSuccess;
  } catch {
    throw new MutationError(
      500,
      "MUTATION_RECEIPT_INVALID",
      "저장된 변경 결과를 확인하지 못했습니다."
    );
  }
}

export async function applyMutation(
  env: Env,
  tripId: string,
  principal: Principal,
  input: unknown,
  now: Date
): Promise<MutationSuccess> {
  if (!(await mutationQueries.hasMembership(
    env,
    tripId,
    principal.memberId
  ))) {
    throw new MutationError(
      404,
      "TRIP_NOT_FOUND",
      "여행을 찾을 수 없습니다."
    );
  }
  const mutation = parseMutation(input);
  const previous = await mutationQueries.findReceipt(
    env,
    mutation.idempotencyKey
  );
  if (previous) {
    return receiptResult(previous, tripId, principal.memberId) as MutationSuccess;
  }
  if (!(await mutationQueries.referencesAreValid(env, tripId, mutation))) {
    throw new MutationError(
      400,
      "MUTATION_REFERENCE_INVALID",
      "참조 대상이 올바르지 않습니다."
    );
  }

  const current = await mutationQueries.findCurrentEntity(
    env,
    tripId,
    principal,
    mutation.entity,
    mutation.entityId
  );
  if (
    mutation.action !== "create"
    && (!current || current.version !== mutation.baseVersion)
  ) {
    throw new MutationError(
      409,
      "VERSION_CONFLICT",
      "다른 기기에서 항목이 수정되었습니다.",
      { current }
    );
  }
  if (mutation.action === "create" && current) {
    throw new MutationError(
      409,
      "VERSION_CONFLICT",
      "이미 존재하는 항목입니다.",
      { current }
    );
  }

  try {
    const applied = await runMutationBatch(
      env,
      tripId,
      principal,
      mutation,
      now.toISOString()
    );
    const stored = await mutationQueries.findReceipt(
      env,
      mutation.idempotencyKey
    );
    if (stored) return receiptResult(stored, tripId, principal.memberId) as MutationSuccess;
    if (!applied) {
      const authoritative = await mutationQueries.findCurrentEntity(
        env,
        tripId,
        principal,
        mutation.entity,
        mutation.entityId
      );
      throw new MutationError(
        409,
        "VERSION_CONFLICT",
        "다른 기기에서 항목이 수정되었습니다.",
        { current: authoritative }
      );
    }
    throw new Error("Mutation receipt missing");
  } catch (error) {
    if (error instanceof MutationError) throw error;
    const stored = await mutationQueries.findReceipt(
      env,
      mutation.idempotencyKey
    ).catch(() => null);
    if (stored) return receiptResult(stored, tripId, principal.memberId) as MutationSuccess;
    throw error;
  }
}

interface CurrentScheduleItem {
  entityId: string;
  tripDayId: string;
  position: number;
  version: number;
}

async function currentScheduleItems(
  env: Env,
  tripId: string,
  mutation: ScheduleReorderRequest
): Promise<CurrentScheduleItem[]> {
  const result = await env.DB.prepare(
    `SELECT id AS entityId, trip_day_id AS tripDayId, position, version
     FROM schedule_items
     WHERE trip_id = ?
       AND id IN (
         SELECT json_extract(requested.value, '$.entityId')
         FROM json_each(?) requested
       )
     ORDER BY position, id`
  ).bind(tripId, JSON.stringify(mutation.payload.items)).all<CurrentScheduleItem>();
  return result.results;
}

function scheduleReorderConflict(
  mutation: ScheduleReorderRequest,
  current: CurrentScheduleItem[]
): MutationError {
  return new MutationError(
    409,
    "VERSION_CONFLICT",
    "다른 기기에서 일정 순서가 수정되었습니다.",
    {
      current: {
        tripDayId: mutation.entityId,
        items: current,
      },
    }
  );
}

function scheduleVersionsMatch(
  mutation: ScheduleReorderRequest,
  current: CurrentScheduleItem[]
): boolean {
  if (
    current.length !== mutation.payload.items.length
    || current.some((item) => item.tripDayId !== mutation.entityId)
  ) return false;
  const versions = new Map(current.map((item) => [item.entityId, item.version]));
  return mutation.payload.items.every(
    (item) => versions.get(item.entityId) === item.baseVersion
  );
}

async function applyScheduleReorder(
  env: Env,
  tripId: string,
  principal: Principal,
  input: unknown,
  now: Date
): Promise<ScheduleReorderMutationSuccess> {
  if (!(await mutationQueries.hasMembership(env, tripId, principal.memberId))) {
    throw new MutationError(
      404,
      "TRIP_NOT_FOUND",
      "여행을 찾을 수 없습니다."
    );
  }
  const mutation = parseScheduleReorder(input);
  const previous = await mutationQueries.findReceipt(env, mutation.idempotencyKey);
  if (previous) {
    return receiptResult(previous, tripId, principal.memberId) as ScheduleReorderMutationSuccess;
  }
  const current = await currentScheduleItems(env, tripId, mutation);
  if (!scheduleVersionsMatch(mutation, current)) {
    throw scheduleReorderConflict(mutation, current);
  }

  try {
    const applied = await runScheduleReorderBatch(
      env,
      tripId,
      principal,
      mutation,
      now.toISOString()
    );
    const stored = await mutationQueries.findReceipt(env, mutation.idempotencyKey);
    if (stored) {
      return receiptResult(stored, tripId, principal.memberId) as ScheduleReorderMutationSuccess;
    }
    if (!applied) {
      throw scheduleReorderConflict(
        mutation,
        await currentScheduleItems(env, tripId, mutation)
      );
    }
    throw new Error("Schedule reorder receipt missing");
  } catch (error) {
    if (error instanceof MutationError) throw error;
    const stored = await mutationQueries.findReceipt(
      env,
      mutation.idempotencyKey
    ).catch(() => null);
    if (stored) {
      return receiptResult(stored, tripId, principal.memberId) as ScheduleReorderMutationSuccess;
    }
    const authoritative = await currentScheduleItems(env, tripId, mutation);
    if (!scheduleVersionsMatch(mutation, authoritative)) {
      throw scheduleReorderConflict(mutation, authoritative);
    }
    throw error;
  }
}

async function validateSettlementGroup(
  env: Env,
  tripId: string,
  mutation: SettlementGroupCreateRequest
): Promise<void> {
  const expenseIdsJson = JSON.stringify(mutation.payload.expenseIds);
  const transferIdsJson = JSON.stringify(
    mutation.payload.transfers.map((transfer) => transfer.entityId)
  );
  const [validReferences, validExpenses, existingTransfer, pendingGroup] = await Promise.all([
    Promise.all(mutation.payload.transfers.map((transfer) =>
      mutationQueries.referencesAreValid(env, tripId, {
        idempotencyKey: mutation.idempotencyKey,
        entity: "settlement_transfer",
        action: "create",
        entityId: transfer.entityId,
        baseVersion: null,
        payload: {
          settlementGroupId: mutation.entityId,
          expenseIds: mutation.payload.expenseIds,
          currency: mutation.payload.currency,
          fromMemberId: transfer.fromMemberId,
          toMemberId: transfer.toMemberId,
          amountMinor: transfer.amountMinor,
          status: "pending",
          completedAt: null,
        },
      })
    )),
    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM expenses
       WHERE trip_id = ? AND is_settled = 0 AND currency = ?
         AND id IN (SELECT value FROM json_each(?))`
    ).bind(
      tripId,
      mutation.payload.currency,
      expenseIdsJson
    ).first<{ count: number }>(),
    env.DB.prepare(
      `SELECT 1 AS found FROM settlement_transfers
       WHERE trip_id = ? AND id IN (SELECT value FROM json_each(?)) LIMIT 1`
    ).bind(tripId, transferIdsJson).first(),
    env.DB.prepare(
      `SELECT 1 AS found
       FROM settlement_transfers transfer,
         json_each(transfer.expense_ids_json) expense
       WHERE transfer.trip_id = ? AND transfer.status = 'pending'
         AND expense.value IN (SELECT value FROM json_each(?))
       LIMIT 1`
    ).bind(tripId, expenseIdsJson).first(),
  ]);
  if (
    validReferences.some((valid) => !valid)
    || Number(validExpenses?.count ?? 0) !== mutation.payload.expenseIds.length
    || existingTransfer
    || pendingGroup
  ) {
    throw new MutationError(
      409,
      "SETTLEMENT_GROUP_CONFLICT",
      "이미 정산 중이거나 정산할 수 없는 비용이 포함되어 있습니다."
    );
  }
}

async function applySettlementGroup(
  env: Env,
  tripId: string,
  principal: Principal,
  input: unknown,
  now: Date
): Promise<SettlementGroupMutationSuccess> {
  if (!(await mutationQueries.hasMembership(env, tripId, principal.memberId))) {
    throw new MutationError(
      404,
      "TRIP_NOT_FOUND",
      "여행을 찾을 수 없습니다."
    );
  }
  const mutation = parseSettlementGroup(input);
  const previous = await mutationQueries.findReceipt(env, mutation.idempotencyKey);
  if (previous) {
    return receiptResult(previous, tripId, principal.memberId) as SettlementGroupMutationSuccess;
  }
  await validateSettlementGroup(env, tripId, mutation);

  try {
    const applied = await runSettlementGroupBatch(
      env,
      tripId,
      principal,
      mutation,
      now.toISOString()
    );
    const stored = await mutationQueries.findReceipt(env, mutation.idempotencyKey);
    if (stored) {
      return receiptResult(stored, tripId, principal.memberId) as SettlementGroupMutationSuccess;
    }
    if (!applied) {
      throw new MutationError(
        409,
        "SETTLEMENT_GROUP_CONFLICT",
        "정산 묶음을 저장하지 못했습니다."
      );
    }
    throw new Error("Settlement group receipt missing");
  } catch (error) {
    if (error instanceof MutationError) throw error;
    const stored = await mutationQueries.findReceipt(
      env,
      mutation.idempotencyKey
    ).catch(() => null);
    if (stored) {
      return receiptResult(stored, tripId, principal.memberId) as SettlementGroupMutationSuccess;
    }
    await validateSettlementGroup(env, tripId, mutation);
    throw error;
  }
}

async function applySettlementComplete(
  env: Env,
  tripId: string,
  principal: Principal,
  input: unknown,
  now: Date
): Promise<MutationSuccess> {
  if (!(await mutationQueries.hasMembership(env, tripId, principal.memberId))) {
    throw new MutationError(
      404,
      "TRIP_NOT_FOUND",
      "여행을 찾을 수 없습니다."
    );
  }
  const mutation = parseSettlementComplete(input);
  const previous = await mutationQueries.findReceipt(env, mutation.idempotencyKey);
  if (previous) {
    return receiptResult(previous, tripId, principal.memberId) as MutationSuccess;
  }
  const current = await mutationQueries.findCurrentEntity(
    env,
    tripId,
    principal,
    "settlement_transfer",
    mutation.entityId
  );
  if (
    !current
    || current.version !== mutation.baseVersion
    || current.status !== "pending"
    || current.settlementGroupId !== mutation.payload.settlementGroupId
  ) {
    throw new MutationError(
      409,
      "VERSION_CONFLICT",
      "다른 기기에서 송금 상태가 수정되었습니다.",
      { current }
    );
  }

  try {
    const applied = await runSettlementTransferCompleteBatch(
      env,
      tripId,
      principal,
      mutation,
      current.expenseIds,
      now.toISOString()
    );
    const stored = await mutationQueries.findReceipt(env, mutation.idempotencyKey);
    if (stored) {
      return receiptResult(stored, tripId, principal.memberId) as MutationSuccess;
    }
    if (!applied) {
      const authoritative = await mutationQueries.findCurrentEntity(
        env,
        tripId,
        principal,
        "settlement_transfer",
        mutation.entityId
      );
      throw new MutationError(
        409,
        "VERSION_CONFLICT",
        "다른 기기에서 송금 상태가 수정되었습니다.",
        { current: authoritative }
      );
    }
    throw new Error("Settlement completion receipt missing");
  } catch (error) {
    if (error instanceof MutationError) throw error;
    const stored = await mutationQueries.findReceipt(
      env,
      mutation.idempotencyKey
    ).catch(() => null);
    if (stored) {
      return receiptResult(stored, tripId, principal.memberId) as MutationSuccess;
    }
    throw error;
  }
}

export function applySyncMutation(
  env: Env,
  tripId: string,
  principal: Principal,
  input: unknown,
  now: Date
): Promise<SyncMutationSuccess> {
  if (
    input !== null
    && typeof input === "object"
    && "action" in input
    && input.action === "reorder"
  ) {
    return applyScheduleReorder(env, tripId, principal, input, now);
  }
  if (
    input !== null
    && typeof input === "object"
    && "action" in input
    && (input.action === "create_group" || input.action === "complete")
  ) {
    return input.action === "create_group"
      ? applySettlementGroup(env, tripId, principal, input, now)
      : applySettlementComplete(env, tripId, principal, input, now);
  }
  return applyMutation(env, tripId, principal, input, now);
}
