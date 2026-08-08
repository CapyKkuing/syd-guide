import type { MutableTravelGuideDataSource } from "../../data/contracts";
import type { EntityKind } from "../../shared/entities";
import type {
  MutationPayloadMap,
  MutationRequest,
  MutationSuccess,
  ScheduleReorderMutationSuccess,
  ScheduleReorderRequest,
  SettlementGroupCreateRequest,
  SettlementGroupMutationSuccess,
  SettlementTransferCompleteRequest,
  SyncMutationRequest,
  SyncMutationSuccess,
} from "../../shared/mutations";

export const ONLINE_REQUIRED_MESSAGE =
  "인터넷 연결이 필요합니다. 연결을 확인한 뒤 다시 시도해 주세요.";

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

export interface ScheduleReorderItemDraft {
  entityId: string;
  baseVersion: number;
  position: number;
}

export interface TripMutationController {
  // eslint-disable-next-line no-unused-vars
  submit<K extends EntityKind>(entity: K, action: MutationRequest<K>["action"], entityId: string, baseVersion: number | null, payload: MutationPayloadMap[K] | null): Promise<MutationSuccess>;
  // eslint-disable-next-line no-unused-vars
  reorderScheduleItems?(tripDayId: string, items: ScheduleReorderItemDraft[]): Promise<ScheduleReorderMutationSuccess>;
  // eslint-disable-next-line no-unused-vars
  createSettlementGroup?(expenseIds: string[], currency: string, transfers: SettlementTransferDraft[]): Promise<SettlementGroupMutationSuccess>;
  // eslint-disable-next-line no-unused-vars
  completeSettlementTransfer?(entityId: string, baseVersion: number, settlementGroupId: string): Promise<MutationSuccess>;
}

export function createTripMutationController({
  tripId,
  transport,
  dataSource,
  reload,
  createId = () => crypto.randomUUID(),
  isOnline = () => window.navigator.onLine
}: {
  tripId: string;
  transport: MutationTransport;
  dataSource: Pick<MutableTravelGuideDataSource, "invalidateTrip">;
  reload: () => void;
  createId?: () => string;
  isOnline?: () => boolean;
}): TripMutationController {
  const mutate = async (
    mutation: SyncMutationRequest,
  ): Promise<SyncMutationSuccess> => {
    if (!isOnline()) throw new Error(ONLINE_REQUIRED_MESSAGE);
    try {
      return await transport.mutate(tripId, mutation);
    } catch (error) {
      if (error instanceof TypeError || !isOnline()) {
        throw new Error(ONLINE_REQUIRED_MESSAGE, { cause: error });
      }
      throw error;
    }
  };

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
      const result = await mutate(mutation);
      if ("transfers" in result || "items" in result) {
        throw new Error("단건 변경에서 정산 묶음 결과를 받았습니다.");
      }
      dataSource.invalidateTrip(tripId, result.syncVersion);
      reload();
      return result;
    },
    async reorderScheduleItems(tripDayId, items) {
      const mutation: ScheduleReorderRequest = {
        idempotencyKey: createId(),
        entity: "schedule_item",
        action: "reorder",
        entityId: tripDayId,
        baseVersion: null,
        payload: { items },
      };
      const result = await mutate(mutation);
      if (!("items" in result)) {
        throw new Error("일정 순서 변경 결과를 확인하지 못했습니다.");
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
      const result = await mutate(mutation);
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
      const result = await mutate(mutation);
      if ("transfers" in result || "items" in result) {
        throw new Error("송금 완료에서 정산 묶음 결과를 받았습니다.");
      }
      dataSource.invalidateTrip(tripId, result.syncVersion);
      reload();
      return result;
    }
  };
}
