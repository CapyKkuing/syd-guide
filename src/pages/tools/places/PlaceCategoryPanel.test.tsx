import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../../app/theme/ThemeProvider";
import type { MapPlaceView } from "../../../data/contracts";
import { placesApi } from "../../../services/places/api";
import { PlaceCategoryPanel } from "./PlaceCategoryPanel";

const places = [
  place("restaurant", "Quay"),
  place("cafe", "Sample Coffee"),
];

describe("PlaceCategoryPanel", () => {
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
    vi.spyOn(placesApi, "getDiscovery").mockResolvedValue({
      details: {
        provider: "google-places",
        providerPlaceId: "google-quay",
        name: "Quay",
        address: "Upper Level, Overseas Passenger Terminal",
        latitude: -33.8587,
        longitude: 151.2101,
        mapUrl: "https://maps.google.com/?cid=1",
        rating: 4.5,
        userRatingCount: 1000,
        openNow: true,
        weekdayDescriptions: [],
        phone: null,
        websiteUrl: null,
        photo: null,
      },
      usage: [
        { sku: "text-search-enterprise", used: 1, limit: 800 },
        { sku: "place-details-enterprise", used: 0, limit: 800 },
        { sku: "place-photo", used: 0, limit: 800 },
      ],
    });
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          emptyMessage="맛집 없음"
          places={[
            place("restaurant", "Quay", { isRecommended: true, isSaved: true }),
            place("restaurant", "Bennelong", { isRecommended: true, isSaved: false }),
          ]}
          tripId="trip-1"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    expect(await screen.findAllByText("★ 4.5 (1,000)")).toHaveLength(2);
    const quayCard = screen.getByRole("heading", { name: "Quay" })
      .closest(".place-discovery-card");
    expect(quayCard).not.toBeNull();
    expect(within(quayCard as HTMLElement).getByText("추천")).toBeVisible();
    expect(within(quayCard as HTMLElement).getByText("내 저장")).toBeVisible();
    expect(screen.getByText("사진 0/800")).toBeVisible();
  });

  it("saves a recommended place with provider data and a valid legacy image path", async () => {
    const submit = vi.fn().mockResolvedValue({});
    vi.spyOn(placesApi, "getDiscovery").mockResolvedValue({
      details: {
        provider: "google-places",
        providerPlaceId: "google-quay",
        name: "Quay",
        address: "Upper Level, Overseas Passenger Terminal",
        latitude: -33.8587,
        longitude: 151.2101,
        mapUrl: "https://maps.google.com/?cid=1",
        rating: 4.5,
        userRatingCount: 1000,
        openNow: true,
        weekdayDescriptions: [],
        phone: null,
        websiteUrl: null,
        photo: null,
      },
      usage: [],
    });
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          controller={{ submit }}
          emptyMessage="맛집 없음"
          places={[place("restaurant", "Quay", {
            imageUrl: "images/quay.jpg",
            isRecommended: true,
            isSaved: false,
          })]}
          tripId="trip-1"
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    await screen.findByText("★ 4.5 (1,000)");
    expect(screen.getByRole("img", { name: "Quay 장소 사진" }))
      .toHaveAttribute("src", "/images/quay.jpg");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "place",
      "update",
      "quay",
      1,
      expect.objectContaining({
        imageUrl: "/images/quay.jpg",
        isRecommended: true,
        isSaved: true,
        provider: "google-places",
        providerPlaceId: "google-quay",
        savedBy: "owner",
      })
    );
  });
});

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
    latitude: null,
    longitude: null,
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
