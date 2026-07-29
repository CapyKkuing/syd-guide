/* eslint-disable no-unused-vars */
import {
  resolveTravelDatabase,
  type TravelDatabaseSource,
} from "./database";

export class MediaThumbnailStore {
  constructor(private readonly database: TravelDatabaseSource) {}

  async get(mediaId: string): Promise<Blob | null> {
    const database = await resolveTravelDatabase(this.database);
    const record = await database.get("mediaThumbnails", mediaId);
    return record ? new Blob([record.bytes], { type: record.mimeType }) : null;
  }

  async save(mediaId: string, tripId: string, blob: Blob): Promise<void> {
    const database = await resolveTravelDatabase(this.database);
    await database.put("mediaThumbnails", {
      mediaId,
      tripId,
      bytes: await blob.arrayBuffer(),
      mimeType: blob.type,
      cachedAt: new Date().toISOString(),
    });
  }

  async remove(mediaId: string): Promise<void> {
    const database = await resolveTravelDatabase(this.database);
    await database.delete("mediaThumbnails", mediaId);
  }
}
