import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { Principal } from "../../src/shared/entities";
import type {
  MutationRequest,
  MutationSuccess,
} from "../../src/shared/mutations";
import { entityRegistry, idSchema } from "../db/entity-registry";
import {
  mutationQueries,
  type ReceiptRow,
} from "../db/mutation-queries";
import { runMutationBatch } from "../db/mutation-store";
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
    "note",
    "vote",
  ]),
  action: z.enum(["create", "update", "delete"]),
  entityId: idSchema,
  baseVersion: z.number().int().positive().nullable(),
  payload: z.unknown().nullable(),
});

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
): MutationSuccess {
  if (row.trip_id !== tripId || row.member_id !== memberId) {
    throw new MutationError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "이미 다른 변경에 사용된 멱등 키입니다."
    );
  }
  try {
    return JSON.parse(row.result_json) as MutationSuccess;
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
    return receiptResult(previous, tripId, principal.memberId);
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
    if (stored) return receiptResult(stored, tripId, principal.memberId);
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
    if (stored) return receiptResult(stored, tripId, principal.memberId);
    throw error;
  }
}
