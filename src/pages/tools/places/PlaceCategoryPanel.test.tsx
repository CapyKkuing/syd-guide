import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../../app/theme/ThemeProvider";
import type { MapPlaceView } from "../../../data/contracts";
import { placesApi } from "../../../services/places/api";
import { PlaceCategoryPanel } from "./PlaceCategoryPanel";

const places = [
  place("restaurant", "Quay"),
  place("cafe", "Sample Coffee"),
];

describe("PlaceCategoryPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps categories separate and creates with the selected category", async () => {
    const submit = vi.fn().mockResolvedValue({});
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          controller={{ submit }}
          emptyMessage="맛집 없음"
          places={places}
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    expect(screen.getByRole("heading", { name: "Quay" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Sample Coffee" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "장소 추가" }));
    await userEvent.type(screen.getByLabelText("장소 이름"), "New Restaurant");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "place",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({ category: "restaurant", name: "New Restaurant" })
    );
  });

  it("shows recommended and saved markers together on real discovery cards", async () => {
    vi.spyOn(placesApi, "getRecommendations").mockResolvedValue({
      places: [
        recommendation("google-quay", "Quay", 4.5, 1000),
        recommendation("google-bennelong", "Bennelong", 4.7, 800),
      ],
      usage: [
        { sku: "nearby-search-enterprise", used: 1, limit: 800 },
        { sku: "place-photo", used: 0, limit: 800 },
      ],
    });
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          emptyMessage="맛집 없음"
          places={[
            place("restaurant", "Quay", {
              isSaved: true,
              provider: "google-places",
              providerPlaceId: "google-quay",
            }),
          ]}
          tripId="trip-1"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    expect(await screen.findByText("★ 4.5 (1,000)")).toBeVisible();
    expect(screen.getByText("★ 4.7 (800)")).toBeVisible();
    const quayCard = screen.getByRole("heading", { name: "Quay" })
      .closest(".place-discovery-card");
    expect(quayCard).not.toBeNull();
    expect(within(quayCard as HTMLElement).getByText("추천")).toBeVisible();
    expect(within(quayCard as HTMLElement).getByText("내가 저장")).toBeVisible();
    expect(screen.getByText("검색 1/800 · 사진 0/800")).toBeVisible();
  });

  it("keeps same-name places with different provider ids separate", async () => {
    vi.spyOn(placesApi, "getRecommendations").mockResolvedValue({
      places: [recommendation("google-quay-barangaroo", "Quay", 4.6, 900)],
      usage: [],
    });
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          emptyMessage="맛집 없음"
          places={[
            place("restaurant", "Quay", {
              address: "Circular Quay",
              latitude: -33.858,
              longitude: 151.21,
              provider: "google-places",
              providerPlaceId: "google-quay-circular",
            }),
          ]}
          tripId="trip-1"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByRole("heading", { name: "Quay" })).toHaveLength(2);
    });
    const cards = [...document.querySelectorAll<HTMLElement>(".place-discovery-card")];
    expect(cards).toHaveLength(2);
    expect(cards.filter((card) => within(card).queryByText("내가 저장"))).toHaveLength(1);
  });

  it("saves only the provider id for a new live recommendation", async () => {
    const submit = vi.fn().mockResolvedValue({});
    vi.spyOn(placesApi, "getRecommendations").mockResolvedValue({
      places: [recommendation("google-quay", "Quay", 4.5, 1000)],
      usage: [],
    });
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          controller={{ submit }}
          emptyMessage="맛집 없음"
          places={[place("attraction", "Sydney anchor")]}
          tripId="trip-1"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    await screen.findByText("★ 4.5 (1,000)");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "place",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({
        address: null,
        imageUrl: null,
        isRecommended: false,
        isSaved: true,
        latitude: null,
        longitude: null,
        name: "내가 저장한 Google 장소",
        provider: "google-places",
        providerPlaceId: "google-quay",
        savedBy: "owner",
      })
    );
  });

  it("sorts the current results without calling Google again", async () => {
    const getRecommendations = vi.spyOn(placesApi, "getRecommendations").mockResolvedValue({
      places: [
        recommendation("popular", "Popular Place", 4.4, 2000),
        recommendation("rated", "Rated Place", 4.9, 500),
      ],
      usage: [],
    });
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          emptyMessage="맛집 없음"
          places={[place("attraction", "Sydney anchor")]}
          tripId="trip-1"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    await screen.findByRole("heading", { name: "Popular Place" });
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Popular Place", "Rated Place"]);
    await userEvent.click(screen.getByRole("radio", { name: "평점순" }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Rated Place", "Popular Place"]);
    await userEvent.click(screen.getByRole("radio", { name: "리뷰 많은순" }));
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Popular Place", "Rated Place"]);
    expect(getRecommendations).toHaveBeenCalledOnce();
  });

  it("does not request recommendations when no saved place has coordinates", () => {
    const getRecommendations = vi.spyOn(placesApi, "getRecommendations");
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          emptyMessage="맛집 없음"
          places={[place("restaurant", "Locationless", {
            latitude: null,
            longitude: null,
          })]}
          tripId="trip-1"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "위치가 입력된 장소를 하나 추가하면 주변 추천을 받을 수 있습니다."
    );
    expect(getRecommendations).not.toHaveBeenCalled();
  });
});

function recommendation(
  providerPlaceId: string,
  name: string,
  rating: number,
  userRatingCount: number
) {
  return {
    provider: "google-places" as const,
    providerPlaceId,
    name,
    address: `${name}, Sydney`,
    latitude: -33.86,
    longitude: 151.2,
    mapUrl: `https://maps.google.com/?q=${providerPlaceId}`,
    rating,
    userRatingCount,
    openNow: true,
    weekdayDescriptions: [],
    phone: null,
    websiteUrl: null,
    photo: null,
  };
}

function place(
  category: MapPlaceView["category"],
  name: string,
  overrides: Partial<MapPlaceView> = {}
): MapPlaceView {
  return {
    id: name.toLocaleLowerCase().replaceAll(" ", "-"),
    version: 1,
    name,
    category,
    status: "saved",
    dayDate: null,
    latitude: -33.86,
    longitude: 151.2,
    address: "Sydney",
    description: "",
    mapUrl: null,
    sourceUrl: null,
    imageUrl: null,
    savedBy: "owner",
    isRecommended: false,
    isSaved: true,
    provider: null,
    providerPlaceId: null,
    updatedAt: "2026-08-02T00:00:00.000Z",
    votes: [],
    ...overrides,
  };
}
