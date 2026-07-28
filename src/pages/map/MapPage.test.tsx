import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { MapPlaceView } from "../../data/contracts";
import { createSampleDataSource } from "../../test/travelSamples";
import { MapPage } from "./MapPage";

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

  it("shows a labelled static preview and an always-present semantic list fallback", async () => {
    const { places, days } = await getMapFixtures();
    render(<MapPage places={places} days={days} />);

    const preview = screen.getByRole("img", { name: "선택한 장소의 정적 경로 미리보기" });
    expect(preview).toHaveAttribute("preserveAspectRatio", "none");
    expect(preview.parentElement).toHaveClass("map-preview");
    expect(screen.getByRole("list", { name: "장소 목록" })).toBeVisible();
    expect(screen.getByText("4개 장소")).toBeVisible();
  });

  it("keeps a coordinate-less place in the list without inventing a marker", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const coordinateLess: MapPlaceView = {
      ...firstPlace,
      id: "coordinate-less",
      name: "좌표 없는 장소",
      x: null,
      y: null
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

  it("opens the same read-only sheet from a marker and a place card, then returns focus", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    render(<MapPage places={places} days={days} />);

    const marker = screen.getByRole("button", { name: "Sydney Opera House 상세 보기" });
    await user.click(marker);
    const dialog = screen.getByRole("dialog", { name: "장소 상세" });
    expect(within(dialog).getByText("Sydney Opera House")).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Google 지도 열기" })).toHaveAttribute("href", expect.stringMatching(/^https:/));

    await user.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(marker).toHaveFocus();

    const card = screen.getByRole("button", { name: /Sydney Opera House, 관광, 저장/ });
    await user.click(card);
    const cardDialog = screen.getByRole("dialog", { name: "장소 상세" });
    expect(within(cardDialog).getByText("Bennelong Point, Sydney NSW 2000")).toBeVisible();
    await user.click(within(cardDialog).getByRole("button", { name: "닫기" }));
    expect(card).toHaveFocus();
  });

  it("does not render a Google map link for an unsafe or non-Google URL", async () => {
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
    expect(within(screen.getByRole("dialog", { name: "장소 상세" })).queryByRole("link", { name: "Google 지도 열기" })).not.toBeInTheDocument();
  });

  it("keeps marker percentages finite and within the static preview bounds for invalid coordinates", async () => {
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const invalidPlaces: MapPlaceView[] = [
      { ...firstPlace, id: "outside-low", name: "Outside low", x: -10, y: -2 },
      { ...firstPlace, id: "outside-high", name: "Outside high", x: Number.POSITIVE_INFINITY, y: Number.NaN }
    ];
    render(<MapPage places={invalidPlaces} days={days} />);

    const lowMarker = screen.getByRole("button", { name: "Outside low 상세 보기" });
    const highMarker = screen.getByRole("button", { name: "Outside high 상세 보기" });
    expect(lowMarker).toHaveStyle({ left: "0%", top: "0%" });
    expect(highMarker).toHaveStyle({ left: "0%", top: "0%" });
  });

  it("gives duplicate-name markers distinct hidden descriptions without changing their required names", async () => {
    const user = userEvent.setup();
    const { places, days } = await getMapFixtures();
    const firstPlace = places.at(0);
    if (!firstPlace) throw new Error("fixture place missing");
    const duplicates: MapPlaceView[] = [
      { ...firstPlace, id: "duplicate-one", name: "Same name", address: "First address", x: 10, y: 10 },
      { ...firstPlace, id: "duplicate-two", name: "Same name", address: "Second address", x: 90, y: 65 }
    ];
    render(<MapPage places={duplicates} days={days} />);

    const markers = screen.getAllByRole("button", { name: "Same name 상세 보기" });
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveAccessibleName("Same name 상세 보기");
    expect(markers[1]).toHaveAccessibleName("Same name 상세 보기");
    expect(markers[0]).toHaveAccessibleDescription("숙소 · 방문 · First address");
    expect(markers[1]).toHaveAccessibleDescription("숙소 · 방문 · Second address");
    expect(markers[0]).toHaveAttribute("aria-describedby", expect.stringMatching(/^map-marker-description-/));
    expect(markers[0]).not.toHaveAttribute("aria-describedby", markers[1]?.getAttribute("aria-describedby"));

    await user.click(markers[0]!);
    expect(within(screen.getByRole("dialog", { name: "장소 상세" })).getByText("First address")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "닫기" }));
    await user.click(markers[1]!);
    expect(within(screen.getByRole("dialog", { name: "장소 상세" })).getByText("Second address")).toBeVisible();

    expect(screen.getByRole("button", { name: /Same name, 숙소, 방문, First address/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Same name, 숙소, 방문, Second address/ })).toBeVisible();
  });
});
