import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme/ThemeProvider";
import type { TravelGuideDataSource } from "../data/contracts";
import { FixtureTravelGuideDataSource } from "../data/fixture/fixtureDataSource";
import { TripRoutePage } from "./TripRoutePage";
import { App } from "./App";
import type { SyncRuntime } from "../services/sync/SyncProvider";

const fixture = new FixtureTravelGuideDataSource(() => new Date("2026-07-28T00:00:00.000Z"));

function sourceWith(overrides: Partial<TravelGuideDataSource>): TravelGuideDataSource {
  return {
    listTrips: () => fixture.listTrips(),
    getTripContext: (tripId) => fixture.getTripContext(tripId),
    getToday: (tripId) => fixture.getToday(tripId),
    getSchedule: (tripId) => fixture.getSchedule(tripId),
    getMapPreview: (tripId) => fixture.getMapPreview(tripId),
    getTools: (tripId) => fixture.getTools(tripId),
    ...overrides
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function renderTripRoute(dataSource: TravelGuideDataSource, activeTab: "today" | "schedule" | "map" | "tools") {
  return render(
    <ThemeProvider>
      <TripRoutePage dataSource={dataSource} tripId="sydney-2026" activeTab={activeTab} />
    </ThemeProvider>
  );
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("TripRoutePage", () => {
  it("shows a text-only loading status while workspace data is pending", () => {
    const pending = new Promise<never>(() => undefined);
    renderTripRoute(sourceWith({
      getTripContext: () => pending,
      getToday: () => pending,
      getSchedule: () => pending,
      getMapPreview: () => pending,
      getTools: () => pending
    }), "today");

    expect(screen.getByRole("status")).toHaveTextContent("여행 정보를 불러오는 중");
    expect(screen.getByRole("status")).not.toHaveTextContent(/[0-9]/);
  });

  it("retries a failed workspace load", async () => {
    const getTripContext = vi.fn()
      .mockRejectedValueOnce(new Error("연결을 확인해 주세요."))
      .mockImplementation((tripId: string) => fixture.getTripContext(tripId));
    renderTripRoute(sourceWith({ getTripContext }), "today");

    expect(await screen.findByRole("alert")).toHaveTextContent("연결을 확인해 주세요.");
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(await screen.findByRole("heading", { name: "오늘" })).toBeVisible();
    expect(getTripContext).toHaveBeenCalledTimes(2);
  });

  it("offers a library action when a trip is missing", async () => {
    window.history.replaceState(null, "", "/trip/missing/today");
    render(<App dataSource={sourceWith({
      getTripContext: () => Promise.resolve(null),
      getToday: () => Promise.resolve(null),
      getSchedule: () => Promise.resolve(null),
      getMapPreview: () => Promise.resolve(null),
      getTools: () => Promise.resolve(null)
    })} />);

    expect(await screen.findByRole("heading", { name: "여행을 찾을 수 없습니다" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "여행 서재로 이동" }));
    expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
  });

  it.each([
    ["today", "오늘"],
    ["map", "지도"],
    ["tools", "도구"]
  ] as const)("renders the semantic %s placeholder heading when ready", async (activeTab, heading) => {
    renderTripRoute(fixture, activeTab);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
  });

  it.each([
    "bondi-weekend",
    "sydney-2026",
    "blue-mountains-memory"
  ])("keeps one route-level Today H1 for the %s phase", async (tripId) => {
    window.history.replaceState(null, "", `/trip/${tripId}/today`);
    render(<App dataSource={fixture} />);

    expect(await screen.findByRole("heading", { level: 1, name: "오늘" })).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("integrates the real tools groups and device-management slot on the tools route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(Response.json({
        principal: { memberId: "owner", role: "owner" },
        devices: []
      })))
    );
    renderTripRoute(fixture, "tools");

    expect(await screen.findByRole("heading", { name: "Travel Essentials" })).toBeVisible();
    expect(await screen.findByText("읽기 전용 미리보기에서는 기기를 관리할 수 없습니다.")).toBeVisible();
  });

  it.each([
    ["#bookings", "bookings"],
    ["#devices", "devices"],
    ["#emergency", "emergency"]
  ])("scrolls the deferred tools %s target only after its workspace mounts", async (hash, targetId) => {
    const workspace = deferred();
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, "", `/trip/sydney-2026/tools${hash}`);
    const delayedSource = sourceWith({
      getTripContext: () => workspace.promise.then(() => fixture.getTripContext("sydney-2026")),
      getToday: () => workspace.promise.then(() => fixture.getToday("sydney-2026")),
      getSchedule: () => workspace.promise.then(() => fixture.getSchedule("sydney-2026")),
      getMapPreview: () => workspace.promise.then(() => fixture.getMapPreview("sydney-2026")),
      getTools: () => workspace.promise.then(() => fixture.getTools("sydney-2026"))
    });

    try {
      render(<App dataSource={delayedSource} />);
      expect(document.getElementById(targetId)).not.toBeInTheDocument();
      expect(scrollIntoView).not.toHaveBeenCalled();

      await act(async () => workspace.resolve());

      const targetHeading = targetId === "bookings"
        ? "예약·바우처"
        : targetId === "devices"
          ? "연결 기기 관리"
          : "비상 연락처";
      expect(await screen.findByRole("heading", { name: targetHeading })).toBeVisible();
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" }));
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it("does not scroll an unsupported hash after a deferred tools workspace mounts", async () => {
    const workspace = deferred();
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, "", "/trip/sydney-2026/tools#unsupported");
    const delayedSource = sourceWith({
      getTripContext: () => workspace.promise.then(() => fixture.getTripContext("sydney-2026")),
      getToday: () => workspace.promise.then(() => fixture.getToday("sydney-2026")),
      getSchedule: () => workspace.promise.then(() => fixture.getSchedule("sydney-2026")),
      getMapPreview: () => workspace.promise.then(() => fixture.getMapPreview("sydney-2026")),
      getTools: () => workspace.promise.then(() => fixture.getTools("sydney-2026"))
    });

    try {
      render(<App dataSource={delayedSource} />);
      await act(async () => workspace.resolve());
      await screen.findByRole("heading", { name: "Travel Essentials" });
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it("renders the selected schedule list for the schedule route", async () => {
    renderTripRoute(fixture, "schedule");

    expect(await screen.findByRole("heading", { name: "도착 후 하버 산책" })).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "전체 일정" }));
    expect(screen.getByRole("button", { name: /호텔 체크인/ })).toBeVisible();
  });

  it("reloads Today and Schedule together after a live schedule mutation", async () => {
    const getToday = vi.fn(fixture.getToday.bind(fixture));
    const getSchedule = vi.fn(fixture.getSchedule.bind(fixture));
    const invalidateTrip = vi.fn();
    const dataSource = {
      ...sourceWith({ getToday, getSchedule }),
      invalidateTrip
    };
    const mutationTransport = {
      mutate: vi.fn().mockResolvedValue({
        entity: "schedule_item",
        entityId: "schedule-new",
        version: 1,
        syncVersion: 8
      })
    };
    render(
      <ThemeProvider>
        <TripRoutePage
          activeTab="schedule"
          dataSource={dataSource}
          mutationTransport={mutationTransport}
          tripId="sydney-2026"
        />
      </ThemeProvider>
    );

    await userEvent.click(await screen.findByRole("button", { name: "일정 추가" }));
    await userEvent.type(screen.getByLabelText("일정 제목"), "새 일정");
    await userEvent.type(screen.getByLabelText("시작 시간"), "18:00");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(getToday).toHaveBeenCalledTimes(2));
    expect(getSchedule).toHaveBeenCalledTimes(2);
    expect(invalidateTrip).toHaveBeenCalledWith("sydney-2026");
  });

  it("keeps identity-dependent controls read-only for an offline fallback workspace", async () => {
    const dataSource = {
      ...sourceWith({
        getTripContext: async (tripId) => {
          const context = await fixture.getTripContext(tripId);
          return context ? {
            ...context,
            viewer: {
              ...context.viewer,
              access: "offline-readonly" as const
            }
          } : null;
        }
      }),
      invalidateTrip: vi.fn()
    };
    const mutationTransport = {
      mutate: vi.fn()
    };

    render(
      <ThemeProvider>
        <TripRoutePage
          activeTab="schedule"
          dataSource={dataSource}
          mutationTransport={mutationTransport}
          tripId="sydney-2026"
        />
      </ThemeProvider>
    );

    expect(await screen.findByRole("button", { name: "일정 추가" })).toBeDisabled();
    expect(screen.getByText("미리보기에서는 일정을 편집할 수 없습니다.")).toBeVisible();
    expect(mutationTransport.mutate).not.toHaveBeenCalled();
  });

  it("mounts trip sync around the existing tools UI", async () => {
    const dataSource = {
      ...sourceWith({}),
      invalidateTrip: vi.fn()
    };
    const runtime: SyncRuntime = {
      engine: {
        flush: vi.fn()
          .mockResolvedValueOnce({
            sent: 1,
            conflict: false,
            sessionInvalid: false
          })
          .mockResolvedValue({
            sent: 0,
            conflict: false,
            sessionInvalid: false
          }),
        keepMine: vi.fn(),
        useLatest: vi.fn()
      },
      outbox: {
        counts: vi.fn().mockResolvedValue({ queued: 2, conflicts: 0 }),
        listForTrip: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockImplementation(() => () => undefined)
      }
    };

    render(
      <ThemeProvider>
        <TripRoutePage
          activeTab="tools"
          dataSource={dataSource}
          syncRuntime={runtime}
          tripId="sydney-2026"
        />
      </ThemeProvider>
    );

    expect(await screen.findByRole("heading", { name: "Travel Essentials" })).toBeVisible();
    await waitFor(() => expect(runtime.engine.flush).toHaveBeenCalledWith("sydney-2026"));
    expect(await screen.findByText("대기 2건")).toBeVisible();
    await waitFor(() =>
      expect(screen.getByText(/마지막 동기화/)).not.toHaveTextContent("없음")
    );
  });
});
