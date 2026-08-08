import type { Principal } from "../../src/shared/entities";
import type {
  MediaPreview,
  TripBookingStorage,
  TripMedia,
  TripMediaStorage,
} from "../../src/shared/media";
import type { Env } from "../env";

type Row = Record<string, unknown>;

export interface MediaInput {
  providerObjectId: string;
  thumbnailObjectId: string;
  originalName: string;
  mimeType: TripMedia["mimeType"];
  width: number;
  height: number;
  capturedAt: string | null;
  aiScore: number | null;
  aiLabels: string[];
}

export function toTripMedia(row: Row): TripMedia {
  return {
    id: String(row.id),
    tripId: String(row.trip_id),
    kind: "photo",
    provider: "google-drive",
    providerObjectId: String(row.provider_object_id),
    thumbnailObjectId: String(row.thumbnail_object_id),
    originalName: String(row.original_name),
    mimeType: row.mime_type as TripMedia["mimeType"],
    width: Number(row.width),
    height: Number(row.height),
    capturedAt: row.captured_at === null ? null : String(row.captured_at),
    aiScore: row.ai_score === null ? null : Number(row.ai_score),
    aiLabels: JSON.parse(String(row.ai_labels_json)) as string[],
    previewCropAspect: row.preview_crop_aspect as NonNullable<TripMedia["previewCropAspect"]>,
    previewBrightness: Number(row.preview_brightness),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

export function toTripMediaStorage(row: Row): TripMediaStorage {
  return {
    tripId: String(row.trip_id),
    provider: "google-drive",
    rootObjectId: String(row.root_object_id),
    connectedBy: String(row.connected_by),
    connectedAt: String(row.connected_at),
  };
}

export function toTripBookingStorage(row: Row): TripBookingStorage {
  return {
    tripId: String(row.trip_id),
    provider: "google-drive",
    rootObjectId: String(row.root_object_id),
    connectedBy: String(row.connected_by),
    connectedAt: String(row.connected_at),
  };
}

export async function findBookingStorage(
  env: Env,
  tripId: string
): Promise<TripBookingStorage | null> {
  const row = await env.DB.prepare(
    "SELECT * FROM trip_booking_storage WHERE trip_id = ?"
  ).bind(tripId).first<Row>();
  return row ? toTripBookingStorage(row) : null;
}

export async function saveBookingStorage(
  env: Env,
  principal: Principal,
  tripId: string,
  rootObjectId: string,
  now: Date
): Promise<TripBookingStorage> {
  const timestamp = now.toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO trip_booking_storage (
       trip_id, provider, root_object_id, connected_by, connected_at
     ) VALUES (?, 'google-drive', ?, ?, ?)
     ON CONFLICT (trip_id) DO UPDATE SET
       provider = excluded.provider,
       root_object_id = excluded.root_object_id,
       connected_by = excluded.connected_by,
       connected_at = excluded.connected_at
     RETURNING *`
  ).bind(tripId, rootObjectId, principal.memberId, timestamp).first<Row>();
  await touchTrip(env, tripId, principal.memberId, timestamp, false);
  if (!row) throw new Error("Booking storage could not be saved");
  return toTripBookingStorage(row);
}

export async function saveMediaStorage(
  env: Env,
  principal: Principal,
  tripId: string,
  rootObjectId: string,
  now: Date
): Promise<TripMediaStorage> {
  const timestamp = now.toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO trip_media_storage (
       trip_id, provider, root_object_id, connected_by, connected_at
     ) VALUES (?, 'google-drive', ?, ?, ?)
     ON CONFLICT (trip_id) DO UPDATE SET
       provider = excluded.provider,
       root_object_id = excluded.root_object_id,
       connected_by = excluded.connected_by,
       connected_at = excluded.connected_at
     RETURNING *`
  ).bind(tripId, rootObjectId, principal.memberId, timestamp).first<Row>();
  await touchTrip(env, tripId, principal.memberId, timestamp, false);
  if (!row) throw new Error("Media storage could not be saved");
  return toTripMediaStorage(row);
}

export async function createMedia(
  env: Env,
  principal: Principal,
  tripId: string,
  input: MediaInput,
  now: Date
): Promise<TripMedia> {
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  const row = await env.DB.prepare(
    `INSERT INTO trip_media (
       id, trip_id, kind, provider, provider_object_id, thumbnail_object_id,
       original_name, mime_type, width, height, captured_at, ai_score,
       ai_labels_json, created_by, created_at
     ) VALUES (?, ?, 'photo', 'google-drive', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`
  ).bind(
    id,
    tripId,
    input.providerObjectId,
    input.thumbnailObjectId,
    input.originalName,
    input.mimeType,
    input.width,
    input.height,
    input.capturedAt,
    input.aiScore,
    JSON.stringify(input.aiLabels),
    principal.memberId,
    timestamp
  ).first<Row>();
  await touchTrip(env, tripId, principal.memberId, timestamp, false);
  if (!row) throw new Error("Media metadata could not be saved");
  return toTripMedia(row);
}

export async function deleteMedia(
  env: Env,
  principal: Principal,
  tripId: string,
  mediaId: string,
  now: Date
): Promise<boolean> {
  const timestamp = now.toISOString();
  const result = await env.DB.prepare(
    "DELETE FROM trip_media WHERE id = ? AND trip_id = ?"
  ).bind(mediaId, tripId).run();
  if (!result.meta.changes) return false;
  await env.DB.prepare(
    `UPDATE trips SET
       representative_media_id = CASE
         WHEN representative_media_id = ? THEN NULL
         ELSE representative_media_id
       END,
       version = version + 1,
       sync_version = sync_version + 1,
       updated_by = ?,
       updated_at = ?
     WHERE id = ?`
  ).bind(mediaId, principal.memberId, timestamp, tripId).run();
  return true;
}

export async function selectRepresentativeMedia(
  env: Env,
  principal: Principal,
  tripId: string,
  mediaId: string,
  now: Date
): Promise<boolean> {
  const timestamp = now.toISOString();
  const result = await env.DB.prepare(
    `UPDATE trips SET
       representative_media_id = ?,
       version = version + 1,
       sync_version = sync_version + 1,
       updated_by = ?,
       updated_at = ?
     WHERE id = ?
       AND EXISTS (
         SELECT 1 FROM trip_media
         WHERE trip_media.id = ? AND trip_media.trip_id = trips.id
       )`
  ).bind(mediaId, principal.memberId, timestamp, tripId, mediaId).run();
  return Boolean(result.meta.changes);
}

export async function updateMediaPreview(
  env: Env,
  principal: Principal,
  tripId: string,
  mediaId: string,
  preview: MediaPreview,
  now: Date
): Promise<TripMedia | null> {
  const row = await env.DB.prepare(
    `UPDATE trip_media SET
       preview_crop_aspect = ?,
       preview_brightness = ?
     WHERE id = ? AND trip_id = ?
     RETURNING *`
  ).bind(
    preview.previewCropAspect,
    preview.previewBrightness,
    mediaId,
    tripId
  ).first<Row>();
  if (!row) return null;
  await touchTrip(env, tripId, principal.memberId, now.toISOString(), false);
  return toTripMedia(row);
}

async function touchTrip(
  env: Env,
  tripId: string,
  memberId: string,
  timestamp: string,
  bumpVersion: boolean
): Promise<void> {
  await env.DB.prepare(
    `UPDATE trips SET
       version = version + ?,
       sync_version = sync_version + 1,
       updated_by = ?,
       updated_at = ?
     WHERE id = ?`
  ).bind(bumpVersion ? 1 : 0, memberId, timestamp, tripId).run();
}
