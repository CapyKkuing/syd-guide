export type MediaStorageProvider = "google-drive";

export interface MediaPreview {
  previewCropAspect: "1:1" | "4:3" | "3:4" | "16:9";
  previewBrightness: number;
}

export type BookingDocumentMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf";

export interface BookingDocument {
  provider: MediaStorageProvider;
  providerObjectId: string;
  originalName: string;
  mimeType: BookingDocumentMimeType;
}

export interface TripBookingStorage {
  tripId: string;
  provider: MediaStorageProvider;
  rootObjectId: string;
  connectedBy: string;
  connectedAt: string;
}

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
  previewCropAspect?: MediaPreview["previewCropAspect"];
  previewBrightness?: MediaPreview["previewBrightness"];
  createdBy: string;
  createdAt: string;
}
