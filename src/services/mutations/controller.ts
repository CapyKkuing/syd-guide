import type { MutableTravelGuideDataSource } from "../../data/contracts";
import type { EntityKind } from "../../shared/entities";
import type {
  MutationPayloadMap,
  MutationRequest,
  MutationSuccess,
  SettlementGroupCreateRequest,
  SettlementGroupMutationSuccess,
  SettlementTransferCompleteRequest,
  SyncMutationRequest,
  SyncMutationSuccess,
} from "../../shared/mutations";
import type { OutboxStore } from "../offline/outboxStore";

export interface MutationTransport {
  // ESLint's base rule does not recognize TypeScript interface arguments.
  // eslint-disable-next-line no-unused-vars
  mutate(tripId: string, mutation: SyncMutationRequest): Promise<SyncMutationSuccess>;
}

export interface SettlementTransferDraft {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

export interface TripMutationController {
  // eslint-disable-next-line no-unused-vars
  submit<K extends EntityKind>(entity: K, action: MutationRequest<K>["action"], entityId: string, baseVersion: number | null, payload: MutationPayloadMap[K] | null): Promise<MutationSuccess>;
  // eslint-disable-next-line no-unused-vars
  createSettlementGroup?(expenseIds: string[], currency: string, transfers: SettlementTransferDraft[]): Promise<SettlementGroupMutationSuccess>;
  // eslint-disable-next-line no-unused-vars
  completeSettlementTransfer?(entityId: string, baseVersion: number, settlementGroupId: string): Promise<MutationSuccess>;
}

export function createOutboxMutationTransport(
  outbox: Pick<OutboxStore, "enqueue">,
  clock: () => Date = () => new Date()
): MutationTransport {
  return {
    async mutate(tripId: string, mutation: SyncMutationRequest) {
      await outbox.enqueue(tripId, mutation, clock().toISOString());
      if (mutation.action === "create_group") {
        return {
          entity: "settlement_transfer" as const,
          entityId: mutation.entityId,
          version: 0,
          syncVersion: -1,
          transfers: mutation.payload.transfers.map((transfer) => ({
            entityId: transfer.entityId,
            version: 0,
          })),
        };
      }
      return {
        entity: mutation.entity,
        entityId: mutation.entityId,
        version: mutation.baseVersion ?? 0,
        syncVersion: -1
      };
    }
  };
}

export function createTripMutationController({
  tripId,
  transport,
  dataSource,
  reload,
  createId = () => crypto.randomUUID(),
  clock = () => new Date()
}: {
  tripId: string;
  transport: MutationTransport;
  dataSource: Pick<MutableTravelGuideDataSource, "invalidateTrip">
    & Partial<Pick<MutableTravelGuideDataSource, "applyLocalMutation">>;
  reload: () => void;
  createId?: () => string;
  clock?: () => Date;
}): TripMutationController {
  return {
    async submit<K extends EntityKind>(
      entity: K,
      action: MutationRequest<K>["action"],
      entityId: string,
      baseVersion: number | null,
      payload: MutationPayloadMap[K] | null
    ) {
      const mutation: MutationRequest<K> = {
        idempotencyKey: createId(),
        entity,
        action,
        entityId,
        baseVersion,
        payload
      };
      const result = await transport.mutate(tripId, mutation);
      if ("transfers" in result) {
        throw new Error("단건 변경에서 정산 묶음 결과를 받았습니다.");
      }
      if (result.syncVersion < 0) {
        await dataSource.applyLocalMutation?.(tripId, mutation, clock().toISOString());
      }
      dataSource.invalidateTrip(tripId, result.syncVersion);
      reload();
      return result;
    },
    async createSettlementGroup(expenseIds, currency, transfers) {
      const mutation: SettlementGroupCreateRequest = {
        idempotencyKey: createId(),
        entity: "settlement_transfer",
        action: "create_group",
        entityId: createId(),
        baseVersion: null,
        payload: {
          expenseIds,
          currency,
          transfers: transfers.map((transfer) => ({
            entityId: createId(),
            ...transfer,
          })),
        },
      };
      const result = await transport.mutate(tripId, mutation);
      if (!("transfers" in result)) {
        throw new Error("정산 묶음 결과를 확인하지 못했습니다.");
      }
      dataSource.invalidateTrip(tripId, result.syncVersion);
      reload();
      return result;
    },
    async completeSettlementTransfer(entityId, baseVersion, settlementGroupId) {
      const mutation: SettlementTransferCompleteRequest = {
        idempotencyKey: createId(),
        entity: "settlement_transfer",
        action: "complete",
        entityId,
        baseVersion,
        payload: { settlementGroupId },
      };
      const result = await transport.mutate(tripId, mutation);
      if ("transfers" in result) {
        throw new Error("송금 완료에서 정산 묶음 결과를 받았습니다.");
      }
      dataSource.invalidateTrip(tripId, result.syncVersion);
      reload();
      return result;
    }
  };
}
