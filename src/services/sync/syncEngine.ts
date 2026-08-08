import type {
  SyncMutationRequest,
  SyncMutationSuccess,
} from "../../shared/mutations";
import { ApiClientError } from "../api/errors";
import type { OutboxStore } from "../offline/outboxStore";
import type { SnapshotStore } from "../offline/snapshotStore";

export interface SyncTransport {
  // ESLint's base rule does not recognize TypeScript interface arguments.
  // eslint-disable-next-line no-unused-vars
  mutate(tripId: string, mutation: SyncMutationRequest): Promise<SyncMutationSuccess>;
}

export interface SyncFlushResult {
  sent: number;
  conflict: boolean;
  sessionInvalid: boolean;
}

export class SyncEngine {
  private readonly inFlight = new Map<string, Promise<SyncFlushResult>>();
  private readonly outbox: OutboxStore;
  private readonly snapshots: SnapshotStore;
  private readonly transport: SyncTransport;
  private readonly onSessionInvalid: () => void | Promise<void>;

  constructor({
    outbox,
    snapshots,
    transport,
    onSessionInvalid = () => undefined
  }: {
    outbox: OutboxStore;
    snapshots: SnapshotStore;
    transport: SyncTransport;
    onSessionInvalid?: () => void | Promise<void>;
  }) {
    this.outbox = outbox;
    this.snapshots = snapshots;
    this.transport = transport;
    this.onSessionInvalid = onSessionInvalid;
  }

  flush(tripId: string): Promise<SyncFlushResult> {
    const current = this.inFlight.get(tripId);
    if (current) return current;
    const request = this.run(tripId).finally(() => {
      if (this.inFlight.get(tripId) === request) this.inFlight.delete(tripId);
    });
    this.inFlight.set(tripId, request);
    return request;
  }

  async useLatest(tripId: string, idempotencyKey: string): Promise<void> {
    await Promise.all([
      this.outbox.remove(idempotencyKey),
      this.snapshots.delete(tripId)
    ]);
  }

  async keepMine(
    idempotencyKey: string,
    replacementKey: string,
    createdAt = new Date().toISOString()
  ): Promise<void> {
    const record = await this.outbox.get(idempotencyKey);
    if (!record || record.state !== "conflict") {
      throw new Error("다시 보낼 충돌 항목이 없습니다.");
    }
    if (
      record.mutation.action === "create_group"
      || record.mutation.action === "complete"
    ) {
      throw new Error("정산 요청은 충돌 내용 유지로 다시 보낼 수 없습니다.");
    }
    const version = currentVersion(record.conflictCurrent);
    if (version === null) {
      throw new Error("최신 항목 버전을 확인할 수 없습니다.");
    }
    await this.outbox.replaceConflict(idempotencyKey, {
      ...record.mutation,
      idempotencyKey: replacementKey,
      baseVersion: version
    }, createdAt);
  }

  private async run(tripId: string): Promise<SyncFlushResult> {
    const records = await this.outbox.listForTrip(tripId);
    let sent = 0;

    for (const record of records) {
      if (record.state === "conflict") {
        return { sent, conflict: true, sessionInvalid: false };
      }
      await this.outbox.markSending(record.idempotencyKey);
      try {
        await this.transport.mutate(tripId, record.mutation);
        await this.outbox.remove(record.idempotencyKey);
        sent += 1;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          await Promise.all([
            this.outbox.clear(),
            this.snapshots.clear(),
            this.snapshots.clearPrincipal()
          ]);
          await this.onSessionInvalid();
          return { sent, conflict: false, sessionInvalid: true };
        }
        if (
          error instanceof ApiClientError
          && error.status === 409
          && error.code === "VERSION_CONFLICT"
        ) {
          await this.outbox.markConflict(
            record.idempotencyKey,
            error.code,
            conflictCurrent(error.details)
          );
          return { sent, conflict: true, sessionInvalid: false };
        }
        await this.outbox.markQueued(
          record.idempotencyKey,
          errorCode(error)
        );
        return { sent, conflict: false, sessionInvalid: false };
      }
    }

    return { sent, conflict: false, sessionInvalid: false };
  }
}

function conflictCurrent(details: unknown): unknown {
  return details && typeof details === "object" && "current" in details
    ? details.current
    : null;
}

function errorCode(error: unknown): string {
  if (error instanceof ApiClientError) return error.code;
  return error instanceof TypeError ? "NETWORK_ERROR" : "SYNC_ERROR";
}

function currentVersion(current: unknown): number | null {
  return current && typeof current === "object"
    && "version" in current && typeof current.version === "number"
    ? current.version
    : null;
}
