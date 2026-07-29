import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapPlaceView } from "../../data/contracts";
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

describe("MapPage", () => {
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
    render(<MapPage places={places} days={days} />);

    await userEvent.click(screen.getByRole("button", { name: day }));

    expect(screen.getByText(`${expectedCount}개 장소`)).toBeVisible();
  });

  it("filters the place list by a case-insensitive name search and selected day, category, and status", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    render(<MapPage places={places} days={days} />);

    await user.type(screen.getByRole("searchbox", { name: "장소 검색" }), "opera");
    await user.click(screen.getByRole("button", { name: "2026-07-28" }));
    await user.click(screen.getByRole("button", { name: "관광" }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByText("1개 장소")).toBeVisible();
    expect(screen.getByRole("button", { name: /Sydney Opera House, 관광, 저장/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Quay, 맛집, 저장/ })).not.toBeInTheDocument();
  });

  it("filters by address as well as name", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    render(<MapPage places={places} days={days} />);

    await user.type(screen.getByRole("searchbox", { name: "장소 검색" }), "BENNELONG POINT");

    expect(screen.getByText("1개 장소")).toBeVisible();
    expect(screen.getByRole("button", { name: /Sydney Opera House, 관광, 저장/ })).toBeVisible();
  });

  it("shows an online map shell and an always-present semantic list fallback", async () => {
    const { places, days } = await getMapFixtures();
    render(<MapPage places={places} days={days} />);

    expect(screen.getByLabelText("온라인 지도")).toBeVisible();
    expect(screen.getByRole("list", { name: "장소 목록" })).toBeVisible();
    expect(screen.getByText("4개 장소")).toBeVisible();
    await waitFor(() => expect(screen.queryByText("온라인 지도를 불러오는 중입니다.")).not.toBeInTheDocument());
  });

  it("hides the map canvas offline while keeping every saved place available", async () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });

    try {
      const { places, days } = await getMapFixtures();
      render(<MapPage places={places} days={days} />);

      expect(screen.getByRole("status")).toHaveTextContent("오프라인 — 저장된 장소 목록을 표시합니다");
      expect(screen.queryByLabelText("온라인 지도")).not.toBeInTheDocument();
      expect(screen.getByRole("list", { name: "장소 목록" })).toHaveTextContent("Sydney Opera House");
    } finally {
      if (original) Object.defineProperty(window.navigator, "onLine", original);
      else Reflect.deleteProperty(window.navigator, "onLine");
    }
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

    render(<MapPage places={[coordinateLess]} days={days} />);

    expect(screen.getByRole("button", { name: /좌표 없는 장소, 숙소, 방문/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "좌표 없는 장소 상세 보기" }))
      .not.toBeInTheDocument();
  });

  it("resets an empty filtered result", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    render(<MapPage places={places} days={days} />);

    await user.type(screen.getByRole("searchbox", { name: "장소 검색" }), "없는 장소");
    expect(screen.getByText("조건에 맞는 장소가 없습니다")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(screen.getByText("4개 장소")).toBeVisible();
    expect(screen.queryByText("조건에 맞는 장소가 없습니다")).not.toBeInTheDocument();
  });

  it("opens the place sheet from a semantic card, then returns focus", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    render(<MapPage places={places} days={days} />);

    const card = screen.getByRole("button", { name: /Sydney Opera House, 관광, 저장/ });
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
    render(<MapPage places={[unsafePlace]} days={days} />);

    await userEvent.click(screen.getByRole("button", { name: /Unsafe place, 숙소, 방문/ }));
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
    render(<MapPage places={invalidPlaces} days={days} />);

    expect(screen.getByRole("button", { name: /Outside low,/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Outside high,/ })).toBeVisible();
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
    render(<MapPage places={duplicates} days={days} />);

    const firstCard = screen.getByRole("button", { name: /Same name, 숙소, 방문, First address/ });
    const secondCard = screen.getByRole("button", { name: /Same name, 숙소, 방문, Second address/ });
    await user.click(firstCard);
    expect(within(screen.getByRole("dialog", { name: "장소 상세" })).getByText("First address")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "닫기" }));
    await user.click(secondCard);
    expect(within(screen.getByRole("dialog", { name: "장소 상세" })).getByText("Second address")).toBeVisible();

    expect(firstCard).toBeVisible();
    expect(secondCard).toBeVisible();
  });
});
