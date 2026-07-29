import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SessionPrincipal } from "../../features/auth/api";
import type { TripSnapshot } from "../../shared/api";
import type { MutationRequest } from "../../shared/mutations";

export interface SnapshotRecord {
  tripId: string;
  snapshot: TripSnapshot;
  etag: string | null;
  savedAt: string;
}

export interface OutboxRecord {
  idempotencyKey: string;
  tripId: string;
  mutation: MutationRequest;
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
    value: SnapshotRecord;
  };
  outbox: {
    key: string;
    value: OutboxRecord;
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

export function openTravelDatabase(
  name = "couple-travel-guide"
): Promise<TravelDatabase> {
  return openDB<TravelDatabaseSchema>(name, 2, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("snapshots")) {
        database.createObjectStore("snapshots", { keyPath: "tripId" });
      }
      if (!database.objectStoreNames.contains("outbox")) {
        const outbox = database.createObjectStore("outbox", {
          keyPath: "idempotencyKey"
        });
        outbox.createIndex("by-trip-created", ["tripId", "createdAt"]);
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
    }
  });
}

export async function saveOfflinePrincipal(
  database: TravelDatabase,
  principal: SessionPrincipal
): Promise<void> {
  await database.put("settings", {
    key: "session-principal",
    value: { memberId: principal.memberId, role: principal.role }
  });
}

export async function getOfflinePrincipal(
  database: TravelDatabase
): Promise<SessionPrincipal | null> {
  const record = await database.get("settings", "session-principal");
  const value = record?.value;
  if (!value || typeof value !== "object") return null;
  if (!("memberId" in value) || typeof value.memberId !== "string") return null;
  if (!("role" in value) || (value.role !== "owner" && value.role !== "partner")) {
    return null;
  }
  return {
    memberId: value.memberId,
    role: value.role
  };
}

export async function clearOfflinePrincipal(
  database: TravelDatabase
): Promise<void> {
  await database.delete("settings", "session-principal");
}
