/* eslint-disable no-unused-vars */
import type {
  MediaPreview,
  TripBookingStorage,
  TripMedia,
  TripMediaStorage,
} from "../../shared/media";
import { errorFromResponse } from "../api/errors";

type Fetcher = typeof fetch;

export interface MediaConfig {
  provider: "google-drive";
  clientId: string | null;
}

export interface RegisterMediaInput {
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

export type MediaPreviewInput = MediaPreview;

export interface MediaApi {
  getConfig(tripId: string): Promise<MediaConfig>;
  getBookingStorage(tripId: string): Promise<TripBookingStorage | null>;
  saveBookingStorage(
    tripId: string,
    rootObjectId: string
  ): Promise<TripBookingStorage>;
  saveStorage(tripId: string, rootObjectId: string): Promise<TripMediaStorage>;
  register(tripId: string, input: RegisterMediaInput): Promise<TripMedia>;
  selectRepresentative(tripId: string, mediaId: string): Promise<void>;
  savePreview(
    tripId: string,
    mediaId: string,
    preview: MediaPreviewInput
  ): Promise<TripMedia>;
  remove(tripId: string, mediaId: string): Promise<void>;
}

export class MediaApiClient implements MediaApi {
  private readonly fetcher: Fetcher;
  private readonly baseUrl: string;

  constructor(
    fetcher: Fetcher = fetch,
    baseUrl = window.location.origin
  ) {
    this.fetcher = fetcher.bind(globalThis);
    this.baseUrl = baseUrl;
  }

  async getConfig(tripId: string): Promise<MediaConfig> {
    return this.json<MediaConfig>(tripId, "/media/config");
  }

  async getBookingStorage(tripId: string): Promise<TripBookingStorage | null> {
    const result = await this.json<{ storage: TripBookingStorage | null }>(
      tripId,
      "/media/booking-storage"
    );
    return result.storage;
  }

  async saveBookingStorage(
    tripId: string,
    rootObjectId: string
  ): Promise<TripBookingStorage> {
    const result = await this.json<{ storage: TripBookingStorage }>(
      tripId,
      "/media/booking-storage",
      {
        method: "PUT",
        body: JSON.stringify({
          provider: "google-drive",
          rootObjectId,
        }),
      }
    );
    return result.storage;
  }

  async saveStorage(
    tripId: string,
    rootObjectId: string
  ): Promise<TripMediaStorage> {
    const result = await this.json<{ storage: TripMediaStorage }>(
      tripId,
      "/media/storage",
      {
        method: "PUT",
        body: JSON.stringify({
          provider: "google-drive",
          rootObjectId,
        }),
      }
    );
    return result.storage;
  }

  async register(
    tripId: string,
    input: RegisterMediaInput
  ): Promise<TripMedia> {
    const result = await this.json<{ media: TripMedia }>(tripId, "/media", {
      method: "POST",
      body: JSON.stringify({ provider: "google-drive", ...input }),
    });
    return result.media;
  }

  async selectRepresentative(tripId: string, mediaId: string): Promise<void> {
    await this.json(tripId, "/media/representative", {
      method: "PATCH",
      body: JSON.stringify({ mediaId }),
    });
  }

  async savePreview(
    tripId: string,
    mediaId: string,
    preview: MediaPreviewInput
  ): Promise<TripMedia> {
    const result = await this.json<{ media: TripMedia }>(
      tripId,
      `/media/${encodeURIComponent(mediaId)}/preview`,
      {
        method: "PATCH",
        body: JSON.stringify(preview),
      }
    );
    return result.media;
  }

  async remove(tripId: string, mediaId: string): Promise<void> {
    await this.request(
      tripId,
      `/media/${encodeURIComponent(mediaId)}`,
      { method: "DELETE" }
    );
  }

  private async json<T>(
    tripId: string,
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    return (await this.request(tripId, path, init)).json() as Promise<T>;
  }

  private async request(
    tripId: string,
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    const hostname = new URL(this.baseUrl).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      headers.set(
        "X-Dev-Principal",
        localStorage.getItem("couple_dev_principal") === "partner"
          ? "partner"
          : "owner"
      );
    }
    const response = await this.fetcher(
      new URL(
        `/api/trips/${encodeURIComponent(tripId)}${path}`,
        this.baseUrl
      ),
      { ...init, headers, credentials: "same-origin" }
    );
    if (!response.ok) throw await errorFromResponse(response);
    return response;
  }
}

export const mediaApiClient = new MediaApiClient();
