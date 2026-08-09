/* eslint-disable no-unused-vars */
import type { MediaStorageProvider } from "../../shared/media";

export interface MediaObject {
  id: string;
}

export interface MediaStorageProviderClient {
  readonly provider: MediaStorageProvider;
  readonly connected: boolean;
  connect(clientId: string): Promise<void>;
  createFolder(name: string, parentObjectId?: string): Promise<MediaObject>;
  findFolder?(name: string, parentObjectId: string): Promise<MediaObject | null>;
  upload(
    rootObjectId: string,
    name: string,
    blob: Blob
  ): Promise<MediaObject>;
  download(objectId: string): Promise<Blob>;
  remove(objectId: string): Promise<void>;
  folderUrl(rootObjectId: string): string;
}
