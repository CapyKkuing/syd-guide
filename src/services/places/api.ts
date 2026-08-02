import type { PlaceDiscoveryResponse } from "../../shared/places";
import { errorFromResponse } from "../api/errors";

type Fetcher = typeof fetch;

export class PlacesApi {
  private readonly fetcher: Fetcher;
  private readonly discoveryRequests = new Map<string, Promise<PlaceDiscoveryResponse>>();
  private readonly photoRequests = new Map<string, Promise<Blob>>();

  constructor(fetcher: Fetcher = fetch) {
    this.fetcher = fetcher.bind(globalThis);
  }

  async getDiscovery(
    tripId: string,
    placeId: string
  ): Promise<PlaceDiscoveryResponse> {
    const key = `${tripId}:${placeId}`;
    const existing = this.discoveryRequests.get(key);
    if (existing) return existing;
    const request = this.fetcher(
      `/api/trips/${encodeURIComponent(tripId)}/places/${encodeURIComponent(placeId)}/discovery`,
      { credentials: "same-origin", headers: localHeaders() }
    ).then(async (response) => {
      if (!response.ok) throw await errorFromResponse(response);
      return response.json() as Promise<PlaceDiscoveryResponse>;
    }).catch((error: unknown) => {
      this.discoveryRequests.delete(key);
      throw error;
    });
    this.discoveryRequests.set(key, request);
    return request;
  }

  async getPhoto(tripId: string, placeId: string, name: string): Promise<Blob> {
    const key = `${tripId}:${placeId}:${name}`;
    const existing = this.photoRequests.get(key);
    if (existing) return existing;
    const query = new URLSearchParams({ name });
    const request = this.fetcher(
      `/api/trips/${encodeURIComponent(tripId)}/places/${encodeURIComponent(placeId)}/photo?${query}`,
      { credentials: "same-origin", headers: localHeaders() }
    ).then(async (response) => {
      if (!response.ok) throw await errorFromResponse(response);
      return response.blob();
    }).catch((error: unknown) => {
      this.photoRequests.delete(key);
      throw error;
    });
    this.photoRequests.set(key, request);
    return request;
  }
}

function localHeaders(): Headers {
  const headers = new Headers();
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    headers.set(
      "X-Dev-Principal",
      localStorage.getItem("couple_dev_principal") === "partner" ? "partner" : "owner"
    );
  }
  return headers;
}

export const placesApi = new PlacesApi();
