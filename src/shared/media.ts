export type MediaStorageProvider = "google-drive";

export interface TripMediaStorage {
  tripId: string;
  provider: MediaStorageProvider;
  rootObjectId: string;
  connectedBy: string;
  connectedAt: string;
}

export interface TripMedia {
  id: string;
  tripId: string;
  kind: "photo";
  provider: MediaStorageProvider;
  providerObjectId: string;
  thumbnailObjectId: string;
  originalName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  capturedAt: string | null;
  aiScore: number | null;
  aiLabels: string[];
  createdBy: string;
  createdAt: string;
}
