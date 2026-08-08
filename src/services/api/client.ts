import type { TripSnapshot } from "../../shared/api";
import type {
  SyncMutationRequest,
  SyncMutationSuccess,
} from "../../shared/mutations";
import { requestWithAdminAccessRecovery } from "../../features/auth/api";
import { errorFromResponse } from "./errors";

export interface SnapshotResult {
  snapshot: TripSnapshot | null;
  etag: string | null;
  notModified: boolean;
}

type Fetcher = typeof fetch;

function requestHeaders(baseUrl: string, json = false): Headers {
  const headers = new Headers();
  if (json) headers.set("Content-Type", "application/json");
  const hostname = new URL(baseUrl).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const principal = localStorage.getItem("couple_dev_principal") === "partner"
      ? "partner"
      : "owner";
    headers.set("X-Dev-Principal", principal);
  }
  return headers;
}

export class ApiClient {
  private readonly fetcher: Fetcher;
  private readonly baseUrl: string;

  constructor(
    fetcher: Fetcher = fetch,
    baseUrl = window.location.origin
  ) {
    this.fetcher = fetcher.bind(globalThis);
    this.baseUrl = baseUrl;
  }

  private url(path: string): string {
    return new URL(path, this.baseUrl).toString();
  }

  async getTripSnapshot(
    tripId: string,
    etag?: string
  ): Promise<SnapshotResult> {
    const headers = requestHeaders(this.baseUrl);
    if (etag) headers.set("If-None-Match", etag);
    const response = await requestWithAdminAccessRecovery(
      this.fetcher,
      this.url(`/api/trips/${encodeURIComponent(tripId)}/snapshot`),
      { headers, credentials: "same-origin" },
      this.baseUrl
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

  async mutate(
    tripId: string,
    mutation: SyncMutationRequest
  ): Promise<SyncMutationSuccess> {
    const response = await requestWithAdminAccessRecovery(
      this.fetcher,
      this.url(`/api/trips/${encodeURIComponent(tripId)}/mutations`),
      {
        method: "POST",
        credentials: "same-origin",
        headers: requestHeaders(this.baseUrl, true),
        body: JSON.stringify(mutation),
      },
      this.baseUrl
    );
    if (!response.ok) throw await errorFromResponse(response);
    return response.json() as Promise<SyncMutationSuccess>;
  }
}

export const apiClient = new ApiClient();
