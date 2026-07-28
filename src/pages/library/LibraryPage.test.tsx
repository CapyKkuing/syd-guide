import { readFileSync } from "node:fs";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TravelGuideDataSource, TripSummaryViewModel } from "../../data/contracts";
import { createFixturePreviewTripLibraryClient } from "../../features/trips/api";
import { sampleDataSource } from "../../test/travelSamples";
import { LibraryPage } from "./LibraryPage";

const libraryStyles = readFileSync("src/styles/library.css", "utf8");
let libraryStyleElement: HTMLStyleElement;

beforeEach(() => {
  libraryStyleElement = document.createElement("style");
  libraryStyleElement.textContent = libraryStyles;
  document.head.append(libraryStyleElement);
});

afterEach(() => {
  libraryStyleElement.remove();
});

function sourceWithListTrips(
  listTrips: TravelGuideDataSource["listTrips"]
): TravelGuideDataSource {
  return {
    listTrips,
    getTripContext: (tripId) => sampleDataSource.getTripContext(tripId),
    getToday: (tripId) => sampleDataSource.getToday(tripId),
    getSchedule: (tripId) => sampleDataSource.getSchedule(tripId),
    getMapPreview: (tripId) => sampleDataSource.getMapPreview(tripId),
    getTools: (tripId) => sampleDataSource.getTools(tripId)
  };
}

function previewClient(dataSource: TravelGuideDataSource = sampleDataSource) {
  return createFixturePreviewTripLibraryClient(dataSource);
}

describe("LibraryPage", () => {
  it("shows practical trip cards without trip navigation", async () => {
    render(<LibraryPage client={previewClient()} />);

    expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
    expect(screen.getByRole("link", { name: /시드니 여행/ }))
      .toHaveAttribute("href", "/trip/sydney-2026/today");
    expect(screen.queryByRole("navigation", { name: "여행 메뉴" })).not.toBeInTheDocument();
  });

  it("filters trips by status", async () => {
    render(<LibraryPage client={previewClient()} />);

    await userEvent.click(await screen.findByRole("button", { name: "예정" }));

    expect(screen.getByText("본다이 주말")).toBeVisible();
    expect(screen.queryByText("시드니 여행")).not.toBeInTheDocument();
  });

  it("keeps every filter a 44px touch target", async () => {
    render(<LibraryPage client={previewClient()} />);

    const upcomingFilter = await screen.findByRole("button", { name: "예정" });

    expect(getComputedStyle(upcomingFilter).minHeight).toBe("44px");
  });

  it("shows textless loading skeletons until the trip list resolves", async () => {
    // eslint-disable-next-line no-unused-vars -- Promise resolver contract
    let resolveTrips!: (trips: TripSummaryViewModel[]) => void;
    const dataSource = sourceWithListTrips(
      () => new Promise<TripSummaryViewModel[]>((resolve) => { resolveTrips = resolve; })
    );
    render(<LibraryPage client={previewClient(dataSource)} />);

    const loading = screen.getByLabelText("여행을 불러오는 중");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading).toHaveTextContent(/^$/);
    expect(screen.queryByRole("button", { name: "연결 기기" })).not.toBeInTheDocument();

    await act(async () => Promise.resolve());
    await act(async () => resolveTrips(await sampleDataSource.listTrips()));

    expect(await screen.findByRole("button", { name: "연결 기기" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "연결 기기" })).not.toBeInTheDocument();
  });

  it("offers an empty-state retry beside the disabled create-trip explanation", async () => {
    const trips = await sampleDataSource.listTrips();
    const listTrips = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(trips);
    render(<LibraryPage client={previewClient(sourceWithListTrips(listTrips))} />);

    expect(await screen.findByRole("heading", { name: "저장된 여행이 없습니다" })).toBeVisible();
    expect(screen.getByRole("button", { name: "새 여행 만들기" })).toBeDisabled();
    expect(screen.getByText(/GitHub Pages 미리보기에서는 여행을 조회만/)).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));

    expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
    expect(listTrips).toHaveBeenCalledTimes(2);
  });

  it("retries an error state", async () => {
    const trips = await sampleDataSource.listTrips();
    const listTrips = vi.fn()
      .mockRejectedValueOnce(new Error("네트워크 연결을 확인해 주세요."))
      .mockResolvedValueOnce(trips);
    render(<LibraryPage client={previewClient(sourceWithListTrips(listTrips))} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("네트워크 연결을 확인해 주세요.");

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
    expect(listTrips).toHaveBeenCalledTimes(2);
  });
});
