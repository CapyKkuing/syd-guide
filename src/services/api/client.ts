import type { TripSnapshot } from "../../shared/api";
import type {
  MutationRequest,
  MutationSuccess,
} from "../../shared/mutations";
import { errorFromResponse } from "./errors";

export interface SnapshotResult {
  snapshot: TripSnapshot | null;
  etag: string | null;
  notModified: boolean;
}

type Fetcher = typeof fetch;

export class ApiClient {
  private readonly fetcher: Fetcher;
  private readonly baseUrl: string;

  constructor(
    fetcher: Fetcher = fetch,
    baseUrl = window.location.origin
  ) {
    this.fetcher = fetcher;
    this.baseUrl = baseUrl;
  }

  private url(path: string): string {
    return new URL(path, this.baseUrl).toString();
  }

  async getTripSnapshot(
    tripId: string,
    etag?: string
  ): Promise<SnapshotResult> {
    const headers = new Headers();
    if (etag) headers.set("If-None-Match", etag);
    const response = await this.fetcher(
      this.url(`/api/trips/${encodeURIComponent(tripId)}/snapshot`),
      { headers, credentials: "same-origin" }
    );
    if (response.status === 304) {
      return {
        snapshot: null,
        etag: response.headers.get("ETag") ?? etag ?? null,
        notModified: true,
      };
    }
    if (!response.ok) throw await errorFromResponse(response);
    return {
      snapshot: await response.json() as TripSnapshot,
      etag: response.headers.get("ETag"),
      notModified: false,
    };
  }

  async mutate<K extends MutationRequest>(
    tripId: string,
    mutation: K
  ): Promise<MutationSuccess> {
    const response = await this.fetcher(
      this.url(`/api/trips/${encodeURIComponent(tripId)}/mutations`),
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mutation),
      }
    );
    if (!response.ok) throw await errorFromResponse(response);
    return response.json() as Promise<MutationSuccess>;
  }
}

export const apiClient = new ApiClient();
