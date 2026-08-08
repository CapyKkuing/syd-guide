import type { SyncMutationRequest } from "../../shared/mutations";
import {
  resolveTravelDatabase,
  type OutboxRecord,
  type TravelDatabaseSource
} from "./database";

export class OutboxStore {
  private readonly listeners = new Set<() => void>();

  // eslint-disable-next-line no-unused-vars
  constructor(private readonly databaseSource: TravelDatabaseSource) {}

  async enqueue(
    tripId: string,
    mutation: SyncMutationRequest,
    createdAt = new Date().toISOString()
  ): Promise<OutboxRecord> {
    const record: OutboxRecord = {
      idempotencyKey: mutation.idempotencyKey,
      tripId,
      mutation,
      state: "queued",
      attempts: 0,
      createdAt,
      lastErrorCode: null,
      conflictCurrent: null
    };
    const database = await resolveTravelDatabase(this.databaseSource);
    await database.put("outbox", record);
    this.emit();
    return record;
  }

  async get(idempotencyKey: string): Promise<OutboxRecord | undefined> {
    const database = await resolveTravelDatabase(this.databaseSource);
    return database.get("outbox", idempotencyKey);
  }

  async listForTrip(tripId: string): Promise<OutboxRecord[]> {
    const database = await resolveTravelDatabase(this.databaseSource);
    const range = IDBKeyRange.bound([tripId, ""], [tripId, "\uffff"]);
    const records = await database.getAllFromIndex(
      "outbox",
      "by-trip-created",
      range
    );
    return records.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
      || left.idempotencyKey.localeCompare(right.idempotencyKey)
    );
  }

  async markSending(idempotencyKey: string): Promise<void> {
    await this.update(idempotencyKey, (record) => ({
      ...record,
      state: "sending",
      attempts: record.attempts + 1,
      lastErrorCode: null
    }));
  }

  async markQueued(idempotencyKey: string, code: string): Promise<void> {
    await this.update(idempotencyKey, (record) => ({
      ...record,
      state: "queued",
      lastErrorCode: code
    }));
  }

  async markConflict(
    idempotencyKey: string,
    code: string,
    current: unknown
  ): Promise<void> {
    await this.update(idempotencyKey, (record) => ({
      ...record,
      state: "conflict",
      lastErrorCode: code,
      conflictCurrent: current
    }));
  }

  async remove(idempotencyKey: string): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    await database.delete("outbox", idempotencyKey);
    this.emit();
  }

  async replaceConflict(
    idempotencyKey: string,
    mutation: SyncMutationRequest,
    createdAt = new Date().toISOString()
  ): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    const transaction = database.transaction("outbox", "readwrite");
    const store = transaction.objectStore("outbox");
    const current = await store.get(idempotencyKey);
    if (!current || current.state !== "conflict") {
      transaction.abort();
      throw new Error("교체할 충돌 항목이 없습니다.");
    }
    await store.delete(idempotencyKey);
    await store.put({
      idempotencyKey: mutation.idempotencyKey,
      tripId: current.tripId,
      mutation,
      state: "queued",
      attempts: 0,
      createdAt,
      lastErrorCode: null,
      conflictCurrent: null
    });
    await transaction.done;
    this.emit();
  }

  async clear(): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    await database.clear("outbox");
    this.emit();
  }

  async counts(tripId: string): Promise<{ queued: number; conflicts: number }> {
    const records = await this.listForTrip(tripId);
    return {
      queued: records.filter((record) => record.state !== "conflict").length,
      conflicts: records.filter((record) => record.state === "conflict").length
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async update(
    idempotencyKey: string,
    // eslint-disable-next-line no-unused-vars
    updater: (record: OutboxRecord) => OutboxRecord
  ): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    const transaction = database.transaction("outbox", "readwrite");
    const store = transaction.objectStore("outbox");
    const record = await store.get(idempotencyKey);
    if (!record) {
      transaction.abort();
      throw new Error("동기화 대기 항목을 찾을 수 없습니다.");
    }
    await store.put(updater(record));
    await transaction.done;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
