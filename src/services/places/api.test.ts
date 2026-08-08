import { describe, expect, it, vi } from "vitest";
import {
  AutomaticPlacePhotoLimitError,
  PlacesApi,
} from "./api";

describe("PlacesApi automatic photo limit", () => {
  it("loads at most six photos automatically per trip and still allows an opened detail", async () => {
    const fetcher = vi.fn(async () => new Response(new Blob(["photo"]), {
      headers: {
        "Content-Type": "image/jpeg",
        "X-Place-Photo-Limit": "800",
        "X-Place-Photo-Used": "1",
      },
    }));
    const api = new PlacesApi(fetcher);

    for (let index = 0; index < 6; index += 1) {
      await api.getRecommendationPhoto("trip-one", photoName(index), { automatic: true });
    }

    await expect(
      api.getRecommendationPhoto("trip-one", photoName(6), { automatic: true })
    ).rejects.toBeInstanceOf(AutomaticPlacePhotoLimitError);
    expect(fetcher).toHaveBeenCalledTimes(6);

    await api.getRecommendationPhoto("trip-one", photoName(6));
    expect(fetcher).toHaveBeenCalledTimes(7);
  });

  it("reuses one photo across recommendation and saved-place paths", async () => {
    const fetcher = vi.fn(async () => new Response(new Blob(["photo"])));
    const api = new PlacesApi(fetcher);

    await api.getRecommendationPhoto("trip-one", photoName(0), { automatic: true });
    await api.getPhoto("trip-one", "saved-place", photoName(0), { automatic: true });
    for (let index = 1; index < 6; index += 1) {
      await api.getRecommendationPhoto("trip-one", photoName(index), { automatic: true });
    }

    expect(fetcher).toHaveBeenCalledTimes(6);
    await expect(
      api.getRecommendationPhoto("trip-one", photoName(6), { automatic: true })
    ).rejects.toBeInstanceOf(AutomaticPlacePhotoLimitError);
  });

  it("keeps the six-photo automatic budget independent per trip", async () => {
    const fetcher = vi.fn(async () => new Response(new Blob(["photo"])));
    const api = new PlacesApi(fetcher);

    for (let index = 0; index < 6; index += 1) {
      await api.getRecommendationPhoto("trip-one", photoName(index), { automatic: true });
    }
    await api.getRecommendationPhoto("trip-two", photoName(6), { automatic: true });

    expect(fetcher).toHaveBeenCalledTimes(7);
  });
});

describe("PlacesApi cumulative usage", () => {
  it("does not return a lower SKU count from a late or cached recommendation response", async () => {
    let releaseFirstCafe: () => void = () => {};
    const firstCafe = new Promise<Response>((resolve) => {
      releaseFirstCafe = () => resolve(recommendationResponse(145));
    });
    let cafeRequests = 0;
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("category=cafe")) {
        cafeRequests += 1;
        if (cafeRequests === 1) return firstCafe;
        return Promise.resolve(recommendationResponse(150));
      }
      return Promise.resolve(recommendationResponse(149));
    });
    const api = new PlacesApi(fetcher);

    const lateCafe = api.getRecommendations("trip-one", "cafe");
    const restaurant = await api.getRecommendations("trip-one", "restaurant");
    expect(nearbyUsage(restaurant)).toBe(149);

    releaseFirstCafe();
    expect(nearbyUsage(await lateCafe)).toBe(149);
    expect(nearbyUsage(await api.getRecommendations("trip-one", "cafe"))).toBe(149);
    expect(nearbyUsage(await api.getRecommendations("trip-one", "cafe", true))).toBe(150);
  });
});

function recommendationResponse(nearbyUsed: number) {
  return Response.json({
    places: [],
    usage: [
      { sku: "text-search-enterprise", used: 0, limit: 800 },
      { sku: "place-details-enterprise", used: 0, limit: 800 },
      { sku: "nearby-search-enterprise", used: nearbyUsed, limit: 800 },
      { sku: "place-photo", used: 0, limit: 800 },
    ],
  });
}

function nearbyUsage(response: Awaited<ReturnType<PlacesApi["getRecommendations"]>>) {
  return response.usage.find((item) => item.sku === "nearby-search-enterprise")?.used;
}

function photoName(index: number) {
  return `places/place-${index}/photos/photo-${index}`;
}
