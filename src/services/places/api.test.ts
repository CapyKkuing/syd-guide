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

function photoName(index: number) {
  return `places/place-${index}/photos/photo-${index}`;
}
