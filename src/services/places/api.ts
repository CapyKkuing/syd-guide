import type {
  PlaceDiscoveryResponse,
  PlaceRecommendationCategory,
  PlaceRecommendationResponse,
  PlaceProviderUsage,
} from "../../shared/places";
import { errorFromResponse } from "../api/errors";

type Fetcher = typeof fetch;

interface PlacePhotoResult {
  blob: Blob;
  usage: {
    sku: "place-photo";
    used: number;
    limit: number;
  };
}

interface PlacePhotoOptions {
  automatic?: boolean;
}

const automaticPhotoLimitPerTrip = 6;

export class AutomaticPlacePhotoLimitError extends Error {
  constructor() {
    super("Automatic place photo limit reached");
    this.name = "AutomaticPlacePhotoLimitError";
  }
}

export class PlacesApi {
  private readonly fetcher: Fetcher;
  private readonly automaticPhotoRequests = new Map<string, Set<string>>();
  private readonly discoveryRequests = new Map<string, Promise<PlaceDiscoveryResponse>>();
  private readonly recommendationRequests = new Map<string, Promise<PlaceRecommendationResponse>>();
  private readonly photoRequests = new Map<string, Promise<PlacePhotoResult>>();
  private readonly usage = new Map<PlaceProviderUsage["sku"], PlaceProviderUsage>();

  constructor(fetcher: Fetcher = fetch) {
    this.fetcher = fetcher.bind(globalThis);
  }

  async getDiscovery(
    tripId: string,
    placeId: string
  ): Promise<PlaceDiscoveryResponse> {
    const key = `${tripId}:${placeId}`;
    const existing = this.discoveryRequests.get(key);
    if (existing) return existing.then((response) => this.withCumulativeUsage(response));
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
    return request.then((response) => this.withCumulativeUsage(response));
  }

  async getRecommendations(
    tripId: string,
    category: PlaceRecommendationCategory,
    refresh = false
  ): Promise<PlaceRecommendationResponse> {
    const key = `${tripId}:${category}`;
    if (refresh) this.recommendationRequests.delete(key);
    const existing = this.recommendationRequests.get(key);
    if (existing) return existing.then((response) => this.withCumulativeUsage(response));
    const query = new URLSearchParams({ category });
    const request = this.fetcher(
      `/api/trips/${encodeURIComponent(tripId)}/places/recommendations?${query}`,
      { credentials: "same-origin", headers: localHeaders() }
    ).then(async (response) => {
      if (!response.ok) throw await errorFromResponse(response);
      return response.json() as Promise<PlaceRecommendationResponse>;
    }).catch((error: unknown) => {
      this.recommendationRequests.delete(key);
      throw error;
    });
    this.recommendationRequests.set(key, request);
    return request.then((response) => this.withCumulativeUsage(response));
  }

  async getPhoto(
    tripId: string,
    placeId: string,
    name: string,
    options: PlacePhotoOptions = {}
  ): Promise<PlacePhotoResult> {
    const key = `${tripId}:${name}`;
    const existing = this.photoRequests.get(key);
    if (existing) return existing.then((result) => this.withCumulativePhotoUsage(result));
    if (options.automatic && !this.reserveAutomaticPhotoRequest(tripId, key)) {
      throw new AutomaticPlacePhotoLimitError();
    }
    const query = new URLSearchParams({ name });
    const request = this.fetcher(
      `/api/trips/${encodeURIComponent(tripId)}/places/${encodeURIComponent(placeId)}/photo?${query}`,
      { credentials: "same-origin", headers: localHeaders() }
    ).then(async (response) => {
      if (!response.ok) throw await errorFromResponse(response);
      return photoResult(response);
    }).catch((error: unknown) => {
      this.photoRequests.delete(key);
      throw error;
    });
    this.photoRequests.set(key, request);
    return request.then((result) => this.withCumulativePhotoUsage(result));
  }

  async getRecommendationPhoto(
    tripId: string,
    name: string,
    options: PlacePhotoOptions = {}
  ): Promise<PlacePhotoResult> {
    const key = `${tripId}:${name}`;
    const existing = this.photoRequests.get(key);
    if (existing) return existing.then((result) => this.withCumulativePhotoUsage(result));
    if (options.automatic && !this.reserveAutomaticPhotoRequest(tripId, key)) {
      throw new AutomaticPlacePhotoLimitError();
    }
    const query = new URLSearchParams({ name });
    const request = this.fetcher(
      `/api/trips/${encodeURIComponent(tripId)}/places/recommendation-photo?${query}`,
      { credentials: "same-origin", headers: localHeaders() }
    ).then(async (response) => {
      if (!response.ok) throw await errorFromResponse(response);
      return photoResult(response);
    }).catch((error: unknown) => {
      this.photoRequests.delete(key);
      throw error;
    });
    this.photoRequests.set(key, request);
    return request.then((result) => this.withCumulativePhotoUsage(result));
  }

  private reserveAutomaticPhotoRequest(tripId: string, key: string) {
    const requests = this.automaticPhotoRequests.get(tripId) ?? new Set<string>();
    if (requests.has(key) || requests.size >= automaticPhotoLimitPerTrip) return false;
    requests.add(key);
    this.automaticPhotoRequests.set(tripId, requests);
    return true;
  }

  private withCumulativeUsage<T extends { usage: PlaceProviderUsage[] }>(response: T): T {
    return { ...response, usage: response.usage.map((item) => this.rememberUsage(item)) };
  }

  private withCumulativePhotoUsage(result: PlacePhotoResult): PlacePhotoResult {
    return { ...result, usage: this.rememberUsage(result.usage) };
  }

  private rememberUsage<T extends PlaceProviderUsage>(next: T): T {
    const current = this.usage.get(next.sku);
    const latest = current && current.used > next.used
      ? { ...next, used: current.used, limit: current.limit }
      : next;
    this.usage.set(next.sku, latest);
    return latest;
  }
}

async function photoResult(response: Response): Promise<PlacePhotoResult> {
  return {
    blob: await response.blob(),
    usage: {
      sku: "place-photo",
      used: Number(response.headers.get("X-Place-Photo-Used") ?? 0),
      limit: Number(response.headers.get("X-Place-Photo-Limit") ?? 800),
    },
  };
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
