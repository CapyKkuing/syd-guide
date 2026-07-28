import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type {
  MapPreviewViewModel,
  ScheduleViewModel,
  TodayViewModel,
  ToolsViewModel,
  TravelGuideDataSource,
  TripContextViewModel,
  TripSummaryViewModel
} from "./contracts";
import { FixtureTravelGuideDataSource } from "./fixture/fixtureDataSource";
import { useTravelLibrary, useTripWorkspace } from "./useTravelData";

function TripResourceProbe({
  dataSource,
  tripId
}: {
  dataSource: TravelGuideDataSource;
  tripId: string;
}) {
  const result = useTripWorkspace(dataSource, tripId);
  if (result.status === "ready") return <span>{`ready:${result.data.context.trip.id}`}</span>;
  if (result.status === "error" || result.status === "empty") {
    return <button onClick={result.retry}>{result.status}</button>;
  }
  return <span role="status">{result.status}</span>;
}

function LibraryResourceProbe({ dataSource }: { dataSource: TravelGuideDataSource }) {
  const result = useTravelLibrary(dataSource);
  if (result.status === "ready") return <span>{`ready:${result.data.length}`}</span>;
  if (result.status === "error" || result.status === "empty") {
    return <button onClick={result.retry}>{result.status}</button>;
  }
  return <span role="status">{result.status}</span>;
}

function deferred<T>() {
  // ESLint's base no-unused-vars rule does not recognize function-type parameters.
  // eslint-disable-next-line no-unused-vars
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = (value) => resolvePromise(value);
  });
  return { promise, resolve };
}

function nullSource(): TravelGuideDataSource {
  return {
    listTrips: async () => [],
    getTripContext: async () => null,
    getToday: async () => null,
    getSchedule: async () => null,
    getMapPreview: async () => null,
    getTools: async () => null
  };
}

describe("travel data resources", () => {
  it("moves a trip resource from loading to ready", async () => {
    const dataSource = new FixtureTravelGuideDataSource(
      () => new Date("2026-07-28T00:00:00.000Z")
    );
    render(<TripResourceProbe dataSource={dataSource} tripId="sydney-2026" />);

    expect(screen.getByRole("status")).toHaveTextContent("loading");
    expect(await screen.findByText("ready:sydney-2026")).toBeVisible();
  });

  it("distinguishes a missing trip from a request error", async () => {
    render(<TripResourceProbe dataSource={nullSource()} tripId="missing" />);

    expect(await screen.findByRole("button", { name: "empty" })).toBeVisible();
  });

  it("starts every trip request before producing a ready workspace", async () => {
    const source = new FixtureTravelGuideDataSource(() => new Date("2026-07-28T00:00:00.000Z"));
    const context = deferred<TripContextViewModel | null>();
    const today = deferred<TodayViewModel | null>();
    const schedule = deferred<ScheduleViewModel | null>();
    const mapPreview = deferred<MapPreviewViewModel | null>();
    const tools = deferred<ToolsViewModel | null>();
    const dataSource: TravelGuideDataSource = {
      listTrips: source.listTrips.bind(source),
      getTripContext: vi.fn(() => context.promise),
      getToday: vi.fn(() => today.promise),
      getSchedule: vi.fn(() => schedule.promise),
      getMapPreview: vi.fn(() => mapPreview.promise),
      getTools: vi.fn(() => tools.promise)
    };

    render(<TripResourceProbe dataSource={dataSource} tripId="sydney-2026" />);
    expect(dataSource.getTripContext).toHaveBeenCalledWith("sydney-2026");
    expect(dataSource.getToday).toHaveBeenCalledWith("sydney-2026");
    expect(dataSource.getSchedule).toHaveBeenCalledWith("sydney-2026");
    expect(dataSource.getMapPreview).toHaveBeenCalledWith("sydney-2026");
    expect(dataSource.getTools).toHaveBeenCalledWith("sydney-2026");

    const [readyContext, readyToday, readySchedule, readyMap, readyTools] = await Promise.all([
      source.getTripContext("sydney-2026"),
      source.getToday("sydney-2026"),
      source.getSchedule("sydney-2026"),
      source.getMapPreview("sydney-2026"),
      source.getTools("sydney-2026")
    ]);
    act(() => {
      context.resolve(readyContext);
      today.resolve(readyToday);
      schedule.resolve(readySchedule);
      mapPreview.resolve(readyMap);
      tools.resolve(readyTools);
    });

    expect(await screen.findByText("ready:sydney-2026")).toBeVisible();
  });

  it("ignores a superseded trip request after the source changes", async () => {
    const fixture = new FixtureTravelGuideDataSource(() => new Date("2026-07-28T00:00:00.000Z"));
    const delayedContext = deferred<TripContextViewModel | null>();
    const firstSource: TravelGuideDataSource = {
      listTrips: fixture.listTrips.bind(fixture),
      getTripContext: () => delayedContext.promise,
      getToday: fixture.getToday.bind(fixture),
      getSchedule: fixture.getSchedule.bind(fixture),
      getMapPreview: fixture.getMapPreview.bind(fixture),
      getTools: fixture.getTools.bind(fixture)
    };
    const view = render(<TripResourceProbe dataSource={firstSource} tripId="sydney-2026" />);

    view.rerender(<TripResourceProbe dataSource={fixture} tripId="sydney-2026" />);
    expect(await screen.findByText("ready:sydney-2026")).toBeVisible();

    act(() => delayedContext.resolve(null));
    await act(async () => undefined);
    expect(screen.getByText("ready:sydney-2026")).toBeVisible();
  });

  it("retries a rejected workspace request and becomes ready", async () => {
    const fixture = new FixtureTravelGuideDataSource(() => new Date("2026-07-28T00:00:00.000Z"));
    const getToday = vi
      .fn<TravelGuideDataSource["getToday"]>()
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementation(fixture.getToday.bind(fixture));
    const dataSource: TravelGuideDataSource = {
      listTrips: fixture.listTrips.bind(fixture),
      getTripContext: fixture.getTripContext.bind(fixture),
      getToday,
      getSchedule: fixture.getSchedule.bind(fixture),
      getMapPreview: fixture.getMapPreview.bind(fixture),
      getTools: fixture.getTools.bind(fixture)
    };
    render(<TripResourceProbe dataSource={dataSource} tripId="sydney-2026" />);

    await screen.findByRole("button", { name: "error" });
    await act(async () => screen.getByRole("button", { name: "error" }).click());

    expect(await screen.findByText("ready:sydney-2026")).toBeVisible();
    expect(getToday).toHaveBeenCalledTimes(2);
  });

  it("keeps the newer trip ready when a prior tripId request settles late", async () => {
    const fixture = new FixtureTravelGuideDataSource(() => new Date("2026-07-28T00:00:00.000Z"));
    const sydneyContext = await fixture.getTripContext("sydney-2026");
    const delayedSydneyContext = deferred<TripContextViewModel | null>();
    const dataSource: TravelGuideDataSource = {
      listTrips: fixture.listTrips.bind(fixture),
      getTripContext: (tripId) =>
        tripId === "sydney-2026"
          ? delayedSydneyContext.promise
          : fixture.getTripContext(tripId),
      getToday: fixture.getToday.bind(fixture),
      getSchedule: fixture.getSchedule.bind(fixture),
      getMapPreview: fixture.getMapPreview.bind(fixture),
      getTools: fixture.getTools.bind(fixture)
    };
    const view = render(<TripResourceProbe dataSource={dataSource} tripId="sydney-2026" />);

    view.rerender(<TripResourceProbe dataSource={dataSource} tripId="bondi-weekend" />);
    expect(await screen.findByText("ready:bondi-weekend")).toBeVisible();

    act(() => delayedSydneyContext.resolve(sydneyContext));
    await act(async () => undefined);
    expect(screen.getByText("ready:bondi-weekend")).toBeVisible();
  });

  it("retries a failed library request with a new generation", async () => {
    const trips: TripSummaryViewModel[] = [
      {
        id: "trip",
        title: "여행",
        country: "Australia",
        destination: "Sydney",
        startDate: "2026-07-28",
        endDate: "2026-07-29",
        timeZone: "Australia/Sydney",
        phase: "active",
        coverImageUrl: "/trip.jpg",
        travelerCount: 2,
        bookingCount: 0,
        updatedAt: "2026-07-28T00:00:00.000Z"
      }
    ];
    const dataSource = {
      ...nullSource(),
      listTrips: vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(trips)
    };
    render(<LibraryResourceProbe dataSource={dataSource} />);

    await screen.findByRole("button", { name: "error" });
    await act(async () => screen.getByRole("button", { name: "error" }).click());

    expect(await screen.findByText("ready:1")).toBeVisible();
    expect(dataSource.listTrips).toHaveBeenCalledTimes(2);
  });

  it("maps an empty library to an empty retryable state", async () => {
    render(<LibraryResourceProbe dataSource={nullSource()} />);

    expect(await screen.findByRole("button", { name: "empty" })).toBeVisible();
  });
});
