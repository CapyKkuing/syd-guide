import type { MutableTravelGuideDataSource } from "../../data/contracts";
import type { EntityKind } from "../../shared/entities";
import type {
  MutationPayloadMap,
  MutationRequest,
  MutationSuccess
} from "../../shared/mutations";
import type { OutboxStore } from "../offline/outboxStore";

export interface MutationTransport {
  // ESLint's base rule does not recognize TypeScript interface arguments.
  // eslint-disable-next-line no-unused-vars
  mutate<K extends MutationRequest>(tripId: string, mutation: K): Promise<MutationSuccess>;
}

export interface TripMutationController {
  // eslint-disable-next-line no-unused-vars
  submit<K extends EntityKind>(entity: K, action: MutationRequest<K>["action"], entityId: string, baseVersion: number | null, payload: MutationPayloadMap[K] | null): Promise<MutationSuccess>;
}

export function createOutboxMutationTransport(
  outbox: Pick<OutboxStore, "enqueue">,
  clock: () => Date = () => new Date()
): MutationTransport {
  return {
    async mutate<K extends MutationRequest>(tripId: string, mutation: K) {
      await outbox.enqueue(tripId, mutation, clock().toISOString());
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
  createId = () => crypto.randomUUID()
}: {
  tripId: string;
  transport: MutationTransport;
  dataSource: Pick<MutableTravelGuideDataSource, "invalidateTrip">;
  reload: () => void;
  createId?: () => string;
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
      dataSource.invalidateTrip(tripId);
      reload();
      return result;
    }
  };
}
