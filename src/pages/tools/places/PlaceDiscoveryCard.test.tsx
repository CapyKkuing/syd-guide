import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../../app/theme/ThemeProvider";
import type { MapPlaceView } from "../../../data/contracts";
import {
  AutomaticPlacePhotoLimitError,
  placesApi,
} from "../../../services/places/api";
import type { PlaceDiscoveryDetails } from "../../../shared/places";
import { PlaceDiscoveryCard } from "./PlaceDiscoveryCard";

describe("PlaceDiscoveryCard photo policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads a blocked automatic thumbnail when the user opens the detail", async () => {
    const onOpen = vi.fn();
    const getPhoto = vi.spyOn(placesApi, "getRecommendationPhoto")
      .mockImplementation(async (_tripId, _name, options) => {
        if (options?.automatic) throw new AutomaticPlacePhotoLimitError();
        return {
          blob: new Blob(["photo"]),
          usage: { sku: "place-photo", used: 7, limit: 800 },
        };
      });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:place-photo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    render(
      <ThemeProvider>
        <PlaceDiscoveryCard
          initialDiscovery={discovery}
          isRecommendation
          onOpen={onOpen}
          onUsage={vi.fn()}
          place={place}
          tripId="trip-one"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    await waitFor(() => expect(getPhoto).toHaveBeenCalledWith(
      "trip-one",
      discovery.photo?.name,
      { automatic: true }
    ));
    await userEvent.click(screen.getByRole("button", { name: "상세 보기" }));

    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({
      photoUrl: "blob:place-photo",
    })));
    expect(getPhoto).toHaveBeenNthCalledWith(2, "trip-one", discovery.photo?.name);
  });

  it("does not open a stale detail when the card disappears during photo loading", async () => {
    const onOpen = vi.fn();
    const pendingPhoto = deferredPhoto();
    vi.spyOn(placesApi, "getRecommendationPhoto")
      .mockImplementation((_tripId, _name, options) => {
        if (options?.automatic) return Promise.reject(new AutomaticPlacePhotoLimitError());
        return pendingPhoto.promise;
      });
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:place-photo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const { unmount } = render(
      <ThemeProvider>
        <PlaceDiscoveryCard
          initialDiscovery={discovery}
          isRecommendation
          onOpen={onOpen}
          onUsage={vi.fn()}
          place={place}
          tripId="trip-one"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "상세 보기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "사진 불러오는 중" })).toBeDisabled());
    unmount();
    pendingPhoto.resolve({
      blob: new Blob(["photo"]),
      usage: { sku: "place-photo", used: 7, limit: 800 },
    });
    await Promise.resolve();

    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });
});

function deferredPhoto() {
  type PhotoResult = Awaited<ReturnType<typeof placesApi.getRecommendationPhoto>>;
  type ResolvePhoto = Parameters<ConstructorParameters<typeof Promise<PhotoResult>>[0]>[0];
  let resolvePromise: ResolvePhoto | null = null;
  const promise = new Promise<PhotoResult>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(...args: [PhotoResult]) {
      if (!resolvePromise) throw new Error("Photo promise is not initialized");
      resolvePromise(...args);
    },
  };
}

const place: MapPlaceView = {
  id: "transient-place",
  version: 0,
  name: "Sample Cafe",
  category: "cafe",
  status: "saved",
  dayDate: null,
  latitude: -33.86,
  longitude: 151.2,
  address: "Sydney",
  description: "",
  mapUrl: null,
  sourceUrl: null,
  imageUrl: null,
  savedBy: null,
  isRecommended: true,
  isSaved: false,
  provider: "google-places",
  providerPlaceId: "google-sample-cafe",
  updatedAt: "2026-08-03T00:00:00.000Z",
  votes: [],
};

const discovery: PlaceDiscoveryDetails = {
  provider: "google-places",
  providerPlaceId: "google-sample-cafe",
  name: "Sample Cafe",
  address: "Sydney",
  latitude: -33.86,
  longitude: 151.2,
  mapUrl: "https://maps.google.com/?q=sample",
  rating: 4.7,
  userRatingCount: 1200,
  openNow: true,
  weekdayDescriptions: [],
  phone: null,
  websiteUrl: null,
  photo: {
    name: "places/sample/photos/one",
    sourceUrl: null,
    authorAttributions: [],
  },
};
