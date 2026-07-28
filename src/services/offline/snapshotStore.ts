import type { SessionPrincipal } from "../../features/auth/api";
import {
  clearOfflinePrincipal,
  getOfflinePrincipal,
  resolveTravelDatabase,
  saveOfflinePrincipal,
  type SnapshotRecord,
  type TravelDatabaseSource
} from "./database";

export class SnapshotStore {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly databaseSource: TravelDatabaseSource) {}

  async get(tripId: string): Promise<SnapshotRecord | undefined> {
    const database = await resolveTravelDatabase(this.databaseSource);
    return database.get("snapshots", tripId);
  }

  async put(record: SnapshotRecord): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    await database.put("snapshots", record);
  }

  async delete(tripId: string): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    await database.delete("snapshots", tripId);
  }

  async clear(): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    await database.clear("snapshots");
  }

  async getPrincipal(): Promise<SessionPrincipal | null> {
    const database = await resolveTravelDatabase(this.databaseSource);
    return getOfflinePrincipal(database);
  }

  async savePrincipal(principal: SessionPrincipal): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    return saveOfflinePrincipal(database, principal);
  }

  async clearPrincipal(): Promise<void> {
    const database = await resolveTravelDatabase(this.databaseSource);
    return clearOfflinePrincipal(database);
  }
}
