import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TodayViewModel, TripSummaryViewModel } from "../../data/contracts";
import { createSampleDataSource } from "../../test/travelSamples";
import { TodayPage } from "./TodayPage";

const tokenStyles = readFileSync("src/styles/tokens.css", "utf8");

async function todayProps(tripId: string) {
  const dataSource = createSampleDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const [context, today] = await Promise.all([
    dataSource.getTripContext(tripId),
    dataSource.getToday(tripId)
  ]);
  if (!context || !today) throw new Error("sample Today data missing");
  return { trip: context.trip, today };
}

describe("TodayPage", () => {
  it.each([
    ["bondi-weekend", "여행까지", "첫날 미리보기"],
    ["sydney-2026", "NEXT UP", "오늘 일정"],
    ["blue-mountains-memory", "여행 완료", "일정 다시 보기"]
  ] as const)("renders the Today state for %s", async (tripId, marker, action) => {
    render(<TodayPage {...await todayProps(tripId)} />);

    expect(screen.getByText(marker, { exact: false })).toBeVisible();
    expect(screen.getByText(action, { exact: true })).toBeVisible();
  });

  it.each([
    {
      tripId: "bondi-weekend",
      heading: "첫날 일정 미리보기",
      dateTimes: ["2026-08-11"],
      context: "첫날 · 8월 11일 화요일"
    },
    {
      tripId: "sydney-2026",
      heading: "오늘 일정",
      dateTimes: ["2026-07-28"],
      context: "7월 28일 화요일"
    },
    {
      tripId: "blue-mountains-memory",
      heading: "완료 일정 다시 보기",
      dateTimes: ["2026-06-28", "2026-07-01"],
      context: "2026-06-28 — 2026-07-01"
    }
  ])("renders the exact $tripId schedule heading and date context", async ({
    tripId,
    heading,
    dateTimes,
    context
  }) => {
    render(<TodayPage {...await todayProps(tripId)} />);

    const sectionHeading = screen.getByRole("heading", { level: 2, name: heading });
    const section = sectionHeading.closest("section");
    expect(section).not.toBeNull();
    expect(section).toHaveTextContent(context);
    const contextTimes = section!.querySelectorAll(".today-section-heading__eyebrow time");
    expect(contextTimes).toHaveLength(dateTimes.length);
    expect([...contextTimes].map((time) => time.getAttribute("datetime")))
      .toEqual(dateTimes);
  });

  it("labels weather and budget as samples", async () => {
    render(<TodayPage {...await todayProps("sydney-2026")} />);

    expect(screen.getAllByText("샘플").length).toBeGreaterThanOrEqual(2);
  });

  it("marks the first incomplete schedule item with text and keeps items chronological", async () => {
    render(<TodayPage {...await todayProps("sydney-2026")} />);

    const items = screen.getAllByRole("listitem", { name: /일정:/ });
    expect(items[0]).toHaveAccessibleName(/다음 일정/);
    expect(items[0]).toHaveTextContent("10:30");
    expect(items[1]).toHaveTextContent("19:30");
  });

  it("only exposes secure external directions when a movement map URL exists", async () => {
    const { trip, today } = await todayProps("sydney-2026");
    const { rerender } = render(<TodayPage trip={trip} today={today} />);

    expect(screen.getByRole("link", { name: "길찾기" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "길찾기" })).toHaveAttribute("rel", "noreferrer noopener");

    rerender(<TodayPage trip={trip} today={{ ...today, nextMovement: { ...today.nextMovement!, mapUrl: null } }} />);
    expect(screen.queryByRole("link", { name: "길찾기" })).not.toBeInTheDocument();
  });

  it.each([
    "javascript:alert(document.domain)",
    "http://maps.example.test/directions",
    "/directions",
    "not a URL",
    "https://traveler:secret@maps.example.test/directions"
  ])("does not expose directions for an unsafe map URL: %s", async (mapUrl) => {
    const { trip, today } = await todayProps("sydney-2026");
    render(<TodayPage trip={trip} today={{ ...today, nextMovement: { ...today.nextMovement!, mapUrl } }} />);

    expect(screen.queryByRole("link", { name: "길찾기" })).not.toBeInTheDocument();
  });

  it("shows the exact weather, movement, and booking fields with the booking tools route", async () => {
    render(<TodayPage {...await todayProps("sydney-2026")} />);

    expect(screen.getByText("21°C · 맑음")).toBeVisible();
    expect(screen.getByText("Sydney · UV 5")).toBeVisible();
    expect(screen.getByText(/Meriton Sussex Street → Sydney Opera House/)).toBeVisible();
    expect(screen.getByText(/대중교통 · Light rail L2와 도보 약 28분/)).toBeVisible();
    expect(screen.getByText("Quay")).toBeVisible();
    expect(screen.getByRole("link", { name: "예약 상세" }))
      .toHaveAttribute("href", "/trip/sydney-2026/tools#bookings");
  });

  it("encodes reserved and non-ASCII trip IDs in every Today route emitter", async () => {
    const { trip, today } = await todayProps("sydney-2026");
    const encodedTrip = "%EC%84%9C%EC%9A%B8%20%2F%20%E6%9D%B1%E4%BA%AC%3F%23%25";
    render(<TodayPage trip={{ ...trip, id: "서울 / 東京?#%" }} today={today} />);

    for (const link of screen.getAllByRole("link", { name: "전체 일정" })) {
      expect(link).toHaveAttribute("href", `/trip/${encodedTrip}/schedule`);
    }
    expect(screen.getByRole("link", { name: "지도 보기" }))
      .toHaveAttribute("href", `/trip/${encodedTrip}/map`);
    expect(screen.getByRole("link", { name: "예약 상세" }))
      .toHaveAttribute("href", `/trip/${encodedTrip}/tools#bookings`);
    expect(screen.getByRole("link", { name: "예약·바우처" }))
      .toHaveAttribute("href", `/trip/${encodedTrip}/tools#bookings`);
    expect(screen.getByRole("link", { name: "비상 연락처" }))
      .toHaveAttribute("href", `/trip/${encodedTrip}/tools#emergency`);
  });

  it("caps a sample budget percentage at 100 percent", async () => {
    const { trip, today } = await todayProps("sydney-2026");
    const overBudget: TodayViewModel = {
      ...today,
      budget: { ...today.budget, spentAud: 2_000, limitAud: 1_800 }
    };
    render(<TodayPage trip={trip as TripSummaryViewModel} today={overBudget} />);

    expect(screen.getByText("100% 사용")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "예산 사용률" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("keeps a zero budget limit safe", async () => {
    const { trip, today } = await todayProps("sydney-2026");
    render(<TodayPage trip={trip} today={{ ...today, budget: { ...today.budget, limitAud: 0 } }} />);

    expect(screen.getByText("0% 사용")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "예산 사용률" })).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders unavailable copy instead of a false D-day or booking state", async () => {
    const { trip, today } = await todayProps("bondi-weekend");
    render(<TodayPage trip={trip} today={{ ...today, dDay: null, booking: null }} />);

    expect(screen.getByText("출발일 정보를 아직 받지 못했습니다.")).toBeVisible();
    expect(screen.getAllByText("예약 정보를 아직 받지 못했습니다.")).toHaveLength(2);
    expect(screen.queryByText("D-0")).not.toBeInTheDocument();
    expect(screen.queryByText("예약 상태: 확인 필요")).not.toBeInTheDocument();
  });

  it("renders unavailable copy when movement or completed summary data is absent", async () => {
    const active = await todayProps("sydney-2026");
    const { rerender } = render(<TodayPage trip={active.trip} today={{ ...active.today, nextMovement: null }} />);

    expect(screen.getByText("다음 이동 정보가 아직 없습니다.")).toBeVisible();

    const completed = await todayProps("blue-mountains-memory");
    rerender(<TodayPage trip={completed.trip} today={{ ...completed.today, summary: null }} />);
    expect(screen.getByText("여행 요약 정보를 아직 받지 못했습니다.")).toBeVisible();
    expect(screen.queryByText(/방문 장소 0곳/)).not.toBeInTheDocument();
  });

  it("renders the completed cover and exact completed metrics", async () => {
    render(<TodayPage {...await todayProps("blue-mountains-memory")} />);

    expect(screen.getByRole("img", { name: "Blue Mountains 여행의 마지막 대표 장면" }))
      .toHaveAttribute("src", "/images/blue_mountains.jpg");
    expect(screen.getByText("방문 장소 4곳 · 완료 일정 6개")).toBeVisible();
  });

  it("announces completed schedule status in text and each item name", async () => {
    render(<TodayPage {...await todayProps("blue-mountains-memory")} />);

    const completedItem = screen.getByRole("listitem", {
      name: "일정: 호텔 체크인, 완료"
    });
    expect(within(completedItem).getByText("완료")).toHaveClass("today-schedule__status");
    expect(completedItem).toHaveTextContent("예약");
  });

  it("keeps Today boundary tokens at three-to-one or higher against each adjacent surface", () => {
    const lightBoundary = tokenValue("light", "today-boundary");
    const darkBoundary = tokenValue("dark", "today-boundary");

    expect(contrastRatio(lightBoundary, "#FFFDF7")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(lightBoundary, "#F4F2EA")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(darkBoundary, "#151F19")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(darkBoundary, "#0E1511")).toBeGreaterThanOrEqual(3);
  });
});

function tokenValue(theme: "light" | "dark", token: string): string {
  const section = tokenStyles.match(new RegExp(`:root\\[data-theme="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`));
  const body = section?.[1];
  const value = body?.match(new RegExp(`--${token}: (#[0-9A-F]{6});`))?.[1];
  if (!value) throw new Error(`Missing ${token} token for ${theme}`);
  return value;
}

function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)?.map((value) => Number.parseInt(value, 16) / 255);
    if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
    const normalized = channels.map((value) => value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4);
    const [red, green, blue] = normalized;
    if (red === undefined || green === undefined || blue === undefined) throw new Error(`Invalid color: ${hex}`);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  if (lighter === undefined || darker === undefined) throw new Error("Expected two luminance values");
  return (lighter + 0.05) / (darker + 0.05);
}
