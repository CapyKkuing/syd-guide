import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { TripSnapshot } from "../../shared/api";
import type { SyncMutationRequest } from "../../shared/mutations";
import type { TravelReel } from "../../features/memories/reel/types";

interface LegacySnapshotRecord {
  tripId: string;
  snapshot: TripSnapshot;
  etag: string | null;
  savedAt: string;
}

interface LegacyOutboxRecord {
  idempotencyKey: string;
  tripId: string;
  mutation: SyncMutationRequest;
  state: "queued" | "sending" | "conflict";
  attempts: number;
  createdAt: string;
  lastErrorCode: string | null;
  conflictCurrent: unknown | null;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export interface MediaThumbnailRecord {
  mediaId: string;
  tripId: string;
  bytes: ArrayBuffer;
  mimeType: string;
  cachedAt: string;
}

interface TravelDatabaseSchema extends DBSchema {
  snapshots: {
    key: string;
    value: LegacySnapshotRecord;
  };
  outbox: {
    key: string;
    value: LegacyOutboxRecord;
    indexes: { "by-trip-created": [string, string] };
  };
  settings: {
    key: string;
    value: SettingRecord;
  };
  mediaThumbnails: {
    key: string;
    value: MediaThumbnailRecord;
    indexes: { "by-trip": string };
  };
  reels: {
    key: string;
    value: TravelReel;
  };
}

export type TravelDatabase = IDBPDatabase<TravelDatabaseSchema>;
export type TravelDatabaseSource =
  | TravelDatabase
  | Promise<TravelDatabase>
  | (() => Promise<TravelDatabase>);

export function resolveTravelDatabase(
  source: TravelDatabaseSource
): Promise<TravelDatabase> {
  return Promise.resolve(typeof source === "function" ? source() : source);
}

export async function openTravelDatabase(
  name = "couple-travel-guide"
): Promise<TravelDatabase> {
  const database = await openDB<TravelDatabaseSchema>(name, 4, {
    upgrade(database) {
      if (database.objectStoreNames.contains("snapshots")) {
        database.deleteObjectStore("snapshots");
      }
      if (database.objectStoreNames.contains("outbox")) {
        database.deleteObjectStore("outbox");
      }
      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("mediaThumbnails")) {
        const thumbnails = database.createObjectStore("mediaThumbnails", {
          keyPath: "mediaId"
        });
        thumbnails.createIndex("by-trip", "tripId");
      }
      if (!database.objectStoreNames.contains("reels")) {
        database.createObjectStore("reels", { keyPath: "tripId" });
      }
    }
  });
  await database.delete("settings", "session-principal");
  return database;
}
