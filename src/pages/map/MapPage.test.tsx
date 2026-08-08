import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapPlaceView } from "../../data/contracts";
import { placesApi } from "../../services/places/api";
import { createSampleDataSource } from "../../test/travelSamples";
import { MapPage } from "./MapPage";

vi.mock("maplibre-gl", () => ({
  Map: class {
    addControl() {}
    remove() {}
  },
  Marker: class {
    setLngLat() { return this; }
    addTo() { return this; }
  },
  NavigationControl: class {}
}));

async function getMapFixtures(tripId = "sydney-2026") {
  const dataSource = createSampleDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const [mapPreview, schedule] = await Promise.all([
    dataSource.getMapPreview(tripId),
    dataSource.getSchedule(tripId)
  ]);
  if (!mapPreview || !schedule) throw new Error("sample map data missing");
  return { places: mapPreview.places, days: schedule.days };
}

async function renderMapMode({
  days,
  places,
  tripId = "sydney-2026",
}: {
  days: Awaited<ReturnType<typeof getMapFixtures>>["days"];
  places: MapPlaceView[];
  tripId?: string;
}) {
  const result = render(<MapPage days={days} places={places} tripId={tripId} />);
  await userEvent.click(screen.getByRole("button", { name: "지도 보기" }));
  return result;
}

async function selectMapFilter(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string
) {
  const trigger = screen.queryByRole("combobox", { name: label })
    ?? screen.getByRole("button", { name: label });
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("MapPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens with saved restaurants and cafes together, then filters by category", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const savedPlaces: MapPlaceView[] = [
      {
        ...firstPlace,
        id: "saved-restaurant",
        name: "Quay",
        category: "restaurant",
        isSaved: true,
      },
      {
        ...firstPlace,
        id: "saved-cafe",
        name: "Sample Coffee",
        category: "cafe",
        isSaved: true,
      },
      {
        ...firstPlace,
        id: "not-saved-cafe",
        name: "Hidden Coffee",
        category: "cafe",
        isSaved: false,
      },
    ];
    vi.spyOn(placesApi, "getDiscovery").mockResolvedValue({
      details: null,
      usage: [],
    });
    vi.spyOn(placesApi, "getRecommendations").mockResolvedValue({
      places: [],
      usage: [],
    });

    render(<MapPage days={days} places={savedPlaces} tripId="sydney-2026" />);

    expect(screen.getByRole("heading", { level: 1, name: "장소" })).toBeVisible();
    expect(screen.queryByRole("radio", { name: "내 저장" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "추천" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 저장 2" })).toBeVisible();
    expect(screen.getByRole("button", { name: "지도 보기" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Quay" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sample Coffee" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Hidden Coffee" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "길찾기" })).toHaveLength(2);

    await userEvent.click(screen.getByRole("radio", { name: "카페" }));
    expect(screen.queryByRole("heading", { name: "Quay" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sample Coffee" })).toBeVisible();
  });

  it("combines live restaurant and cafe recommendations and marks an already saved place", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const savedRestaurant: MapPlaceView = {
      ...firstPlace,
      id: "saved-quay",
      name: "Quay",
      category: "restaurant",
      isSaved: true,
      provider: "google-places",
      providerPlaceId: "google-quay",
    };
    vi.spyOn(placesApi, "getDiscovery").mockResolvedValue({ details: null, usage: [] });
    const recommendations = vi.spyOn(placesApi, "getRecommendations")
      .mockImplementation(async (_tripId, category) => ({
        places: category === "restaurant"
          ? [recommendation("google-quay", "Quay")]
          : [recommendation("google-sample-coffee", "Sample Coffee")],
        usage: [],
      }));

    render(<MapPage days={days} places={[savedRestaurant]} tripId="sydney-2026" />);

    expect(await screen.findByRole("heading", { name: "Quay" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Sample Coffee" })).toBeVisible();
    const quayCard = screen.getByRole("heading", { name: "Quay" })
      .closest(".place-discovery-card");
    expect(quayCard).not.toBeNull();
    expect(within(quayCard as HTMLElement).getByText("추천")).toBeVisible();
    expect(within(quayCard as HTMLElement).getByText("내가 저장")).toBeVisible();
    expect(recommendations).toHaveBeenCalledWith("sydney-2026", "restaurant", false);
    expect(recommendations).toHaveBeenCalledWith("sydney-2026", "cafe", false);

    await userEvent.click(screen.getByRole("button", { name: "내 저장 1" }));
    expect(screen.getByRole("heading", { name: "Quay" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Sample Coffee" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "내 저장 1" }));
    expect(screen.getByRole("heading", { name: "Sample Coffee" })).toBeVisible();
  });

  it("does not request live recommendations until a saved place has coordinates", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const getRecommendations = vi.spyOn(placesApi, "getRecommendations");

    render(
      <MapPage
        days={days}
        places={[{
          ...firstPlace,
          id: "locationless-place",
          category: "restaurant",
          latitude: null,
          longitude: null,
          isSaved: true,
        }]}
        tripId="sydney-2026"
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "위치가 입력된 장소를 하나 추가하면 주변 추천을 받을 수 있습니다."
    );
    expect(getRecommendations).not.toHaveBeenCalled();
  });

  it.each([
    ["sydney-2026", "2026-07-27", 1],
    ["sydney-2026", "2026-07-28", 2],
    ["sydney-2026", "2026-07-29", 1],
    ["bondi-weekend", "2026-08-11", 1],
    ["bondi-weekend", "2026-08-12", 2],
    ["bondi-weekend", "2026-08-13", 1],
    ["blue-mountains-memory", "2026-06-28", 1],
    ["blue-mountains-memory", "2026-06-29", 2],
    ["blue-mountains-memory", "2026-06-30", 1]
  ] as const)("shows coherent fixture results for %s on offered day %s", async (
    tripId,
    day,
    expectedCount
  ) => {
    const { places, days } = await getMapFixtures(tripId);
    await renderMapMode({ places, days, tripId });

    await selectMapFilter(userEvent.setup(), "날짜", day);

    expect(screen.getByText(`${expectedCount}개 장소`)).toBeVisible();
  });

  it("filters the place list by a case-insensitive name search and selected day, category, and status", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    await renderMapMode({ places, days });

    await user.type(screen.getByRole("textbox", { name: "장소 검색" }), "opera");
    await selectMapFilter(user, "날짜", "2026-07-28");
    await selectMapFilter(user, "분류", "관광");
    await selectMapFilter(user, "장소 상태", "저장");

    expect(screen.getByText("1개 장소")).toBeVisible();
    expect(screen.getByRole("button", { name: /Sydney Opera House관광, 저장/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Quay, 맛집, 저장/ })).not.toBeInTheDocument();
  });

  it("filters by address as well as name", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    await renderMapMode({ places, days });

    await user.type(screen.getByRole("textbox", { name: "장소 검색" }), "BENNELONG POINT");

    expect(screen.getByText("1개 장소")).toBeVisible();
    expect(screen.getByRole("button", { name: /Sydney Opera House관광, 저장/ })).toBeVisible();
  });

  it("uses the saved schedule position for a selected day's map and place list order", async () => {
    const { places, days } = await getMapFixtures();
    const sourceDay = days.find((day) => day.date === "2026-07-28");
    if (!sourceDay) throw new Error("route day missing");
    const routePlaces = places.slice(0, 2).map((place) => ({
      ...place,
      dayDate: sourceDay.date,
    }));
    if (routePlaces.length < 2 || sourceDay.items.length < 2) {
      throw new Error("route fixtures missing");
    }
    const reorderedDay = {
      ...sourceDay,
      items: sourceDay.items.slice(0, 2).map((item, index) => ({
        ...item,
        placeId: routePlaces[index]!.id,
        position: 2 - index,
      })),
    };
    await renderMapMode({ places: routePlaces, days: [reorderedDay] });

    await selectMapFilter(userEvent.setup(), "날짜", reorderedDay.date);

    const cards = within(screen.getByRole("region", { name: "장소 목록" }))
      .getAllByRole("button");
    expect(cards[0]).toHaveAccessibleName(expect.stringContaining(routePlaces[1]!.name));
    expect(cards[1]).toHaveAccessibleName(expect.stringContaining(routePlaces[0]!.name));
  });

  it("shows a place on every day that links to it", async () => {
    const { places, days } = await getMapFixtures();
    const sharedPlace = places[0];
    if (!sharedPlace || days.length < 2 || !days[0]?.items[0] || !days[1]?.items[0]) {
      throw new Error("shared route fixtures missing");
    }
    const linkedDays = days.slice(0, 2).map((day) => ({
      ...day,
      items: day.items.map((item, index) => index === 0
        ? { ...item, placeId: sharedPlace.id }
        : item),
    }));
    await renderMapMode({ places: [sharedPlace], days: linkedDays });

    await selectMapFilter(userEvent.setup(), "날짜", linkedDays[0]!.date);
    expect(screen.getByText("1개 장소")).toBeVisible();
    await selectMapFilter(userEvent.setup(), "날짜", linkedDays[1]!.date);
    expect(screen.getByText("1개 장소")).toBeVisible();
  });

  it("shows an online map shell and an always-present semantic list fallback", async () => {
    const { places, days } = await getMapFixtures();
    await renderMapMode({ places, days });

    expect(screen.getByLabelText("온라인 지도")).toBeVisible();
    expect(screen.getByRole("region", { name: "장소 목록" })).toBeVisible();
    expect(screen.getByText("4개 장소")).toBeVisible();
    await waitFor(() => expect(screen.queryByText("온라인 지도를 불러오는 중입니다.")).not.toBeInTheDocument());
  });

  it("keeps a coordinate-less place in the list without inventing a marker", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const coordinateLess: MapPlaceView = {
      ...firstPlace,
      id: "coordinate-less",
      name: "좌표 없는 장소",
      latitude: null,
      longitude: null
    };

    await renderMapMode({ places: [coordinateLess], days });

    expect(screen.getByRole("button", { name: /좌표 없는 장소숙소, 방문/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "좌표 없는 장소 상세 보기" }))
      .not.toBeInTheDocument();
  });

  it("resets an empty filtered result", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    await renderMapMode({ places, days });

    await user.type(screen.getByRole("textbox", { name: "장소 검색" }), "없는 장소");
    expect(screen.getByText("조건에 맞는 장소가 없습니다")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(screen.getByText("4개 장소")).toBeVisible();
    expect(screen.queryByText("조건에 맞는 장소가 없습니다")).not.toBeInTheDocument();
  });

  it("opens the place sheet from a semantic card, then returns focus", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    await renderMapMode({ places, days });

    const card = screen.getByRole("button", { name: /Sydney Opera House관광, 저장/ });
    await user.click(card);
    const cardDialog = screen.getByRole("dialog", { name: "장소 상세" });
    expect(within(cardDialog).getByText("Bennelong Point, Sydney NSW 2000")).toBeVisible();
    await user.click(within(cardDialog).getByRole("button", { name: "닫기" }));
    expect(card).toHaveFocus();
  });

  it("builds Google Maps links instead of trusting a saved map URL", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const unsafePlace: MapPlaceView = {
      ...firstPlace,
      id: "unsafe-place",
      name: "Unsafe place",
      mapUrl: "https://google.com.evil.example/maps"
    };
    await renderMapMode({ places: [unsafePlace], days });

    await userEvent.click(screen.getByRole("button", { name: /Unsafe place숙소, 방문/ }));
    const dialog = within(screen.getByRole("dialog", { name: "장소 상세" }));
    expect(dialog.getByRole("link", { name: "최신 정보 보기" })).toHaveAttribute("href", expect.stringContaining("www.google.com/maps/search"));
    expect(dialog.getByRole("link", { name: "길찾기" })).toHaveAttribute("href", expect.stringContaining("www.google.com/maps/dir"));
  });

  it("keeps invalid-coordinate places available in the semantic list", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const invalidPlaces: MapPlaceView[] = [
      { ...firstPlace, id: "outside-low", name: "Outside low", latitude: Number.NaN, longitude: 151 },
      { ...firstPlace, id: "outside-high", name: "Outside high", latitude: -33, longitude: Number.POSITIVE_INFINITY }
    ];
    await renderMapMode({ places: invalidPlaces, days });

    expect(screen.getByRole("button", { name: /Outside low숙소/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Outside high숙소/ })).toBeVisible();
  });

  it("keeps duplicate-name place cards distinct and opens the correct place", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const duplicates: MapPlaceView[] = [
      { ...firstPlace, id: "duplicate-one", name: "Same name", address: "First address", latitude: -33.8, longitude: 151.1 },
      { ...firstPlace, id: "duplicate-two", name: "Same name", address: "Second address", latitude: -33.9, longitude: 151.2 }
    ];
    await renderMapMode({ places: duplicates, days });

    const firstCard = screen.getByRole("button", { name: /Same name숙소, 방문, First address/ });
    const secondCard = screen.getByRole("button", { name: /Same name숙소, 방문, Second address/ });
    await user.click(firstCard);
    expect(within(screen.getByRole("dialog", { name: "장소 상세" })).getByText("First address")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "닫기" }));
    await user.click(secondCard);
    expect(within(screen.getByRole("dialog", { name: "장소 상세" })).getByText("Second address")).toBeVisible();

    expect(firstCard).toBeVisible();
    expect(secondCard).toBeVisible();
  });
});

function recommendation(providerPlaceId: string, name: string) {
  return {
    provider: "google-places" as const,
    providerPlaceId,
    name,
    address: `${name}, Sydney`,
    latitude: -33.86,
    longitude: 151.2,
    mapUrl: `https://maps.google.com/?q=${providerPlaceId}`,
    rating: 4.5,
    userRatingCount: 1000,
    openNow: true,
    weekdayDescriptions: [],
    phone: null,
    websiteUrl: null,
    photo: null,
  };
}
