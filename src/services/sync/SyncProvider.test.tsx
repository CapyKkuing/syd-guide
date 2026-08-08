import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, vi } from "vitest";
import { OfflineBanner } from "../../components/OfflineBanner";
import type { OutboxRecord } from "../offline/database";
import { SyncProvider, type SyncRuntime } from "./SyncProvider";

function createRuntime(overrides: {
  records?: OutboxRecord[];
  queued?: number;
  conflicts?: number;
} = {}) {
  const records = overrides.records ?? [];
  const runtime: SyncRuntime = {
    engine: {
      flush: vi.fn().mockResolvedValue({
        sent: 0,
        conflict: records.length > 0,
        sessionInvalid: false,
        syncVersion: null,
      }),
      keepMine: vi.fn().mockResolvedValue(undefined),
      useLatest: vi.fn().mockResolvedValue(undefined)
    },
    outbox: {
      counts: vi.fn().mockResolvedValue({
        queued: overrides.queued ?? 0,
        conflicts: overrides.conflicts ?? records.length
      }),
      listForTrip: vi.fn().mockResolvedValue(records),
      subscribe: vi.fn().mockImplementation(() => () => undefined)
    }
  };
  return runtime;
}

function Harness({
  children,
  runtime,
  createId,
  reload = vi.fn(),
  invalidateTrip = vi.fn()
}: {
  children?: ReactNode;
  runtime: SyncRuntime;
  createId?: () => string;
  reload?: () => void;
  // eslint-disable-next-line no-unused-vars
  invalidateTrip?: (tripId: string) => void;
}) {
  return (
    <SyncProvider
      createId={createId}
      dataSource={{ invalidateTrip }}
      reload={reload}
      runtime={runtime}
      tripId="sydney-2026"
    >
      {children ?? <OfflineBanner />}
    </SyncProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SyncProvider", () => {
  it("flushes on app start and shows queue, conflict, and manual sync status", async () => {
    const runtime = createRuntime({ queued: 2, conflicts: 1 });
    render(<Harness runtime={runtime} />);

    await waitFor(() => expect(runtime.engine.flush).toHaveBeenCalledWith("sydney-2026"));
    expect(screen.getByRole("status")).toHaveTextContent("온라인");
    expect(screen.getByRole("status")).toHaveTextContent("대기 2건");
    expect(screen.getByRole("status")).toHaveTextContent("충돌 1건");

    await userEvent.click(screen.getByRole("button", { name: "지금 동기화" }));
    expect(runtime.engine.flush).toHaveBeenCalledTimes(2);
  });

  it("flushes every 15 seconds only while visible and online", async () => {
    vi.useFakeTimers();
    const runtime = createRuntime();
    const view = render(<Harness runtime={runtime} />);

    await act(async () => undefined);
    expect(runtime.engine.flush).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(runtime.engine.flush).toHaveBeenCalledTimes(2);

    view.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(runtime.engine.flush).toHaveBeenCalledTimes(2);
  });

  it("flushes when the browser comes online or the page becomes visible", async () => {
    const online = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const runtime = createRuntime();

    try {
      render(<Harness runtime={runtime} />);
      expect(runtime.engine.flush).not.toHaveBeenCalled();

      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
      act(() => window.dispatchEvent(new Event("online")));
      await waitFor(() => expect(runtime.engine.flush).toHaveBeenCalledTimes(1));

      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await waitFor(() => expect(runtime.engine.flush).toHaveBeenCalledTimes(2));
    } finally {
      if (online) Object.defineProperty(window.navigator, "onLine", online);
      else Reflect.deleteProperty(window.navigator, "onLine");
      if (visibility) Object.defineProperty(document, "visibilityState", visibility);
      else Reflect.deleteProperty(document, "visibilityState");
    }
  });

  it("uses the server snapshot after choosing latest", async () => {
    const record = conflictRecord();
    const runtime = createRuntime({ records: [record] });
    const invalidateTrip = vi.fn();
    const reload = vi.fn();
    render(
      <Harness
        invalidateTrip={invalidateTrip}
        reload={reload}
        runtime={runtime}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "최신 내용 사용" }));

    expect(runtime.engine.useLatest).toHaveBeenCalledWith(
      "sydney-2026",
      record.idempotencyKey
    );
    expect(invalidateTrip).toHaveBeenCalledWith("sydney-2026");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("requeues the same payload with a new key after choosing mine", async () => {
    const record = conflictRecord();
    const runtime = createRuntime({ records: [record] });
    render(
      <Harness
        createId={() => "replacement-key"}
        runtime={runtime}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "내 수정 유지" }));

    expect(runtime.engine.keepMine).toHaveBeenCalledWith(
      record.idempotencyKey,
      "replacement-key"
    );
    expect(runtime.engine.flush).toHaveBeenCalledTimes(2);
  });

  it("requires the newest successful sync version before reloading", async () => {
    const runtime = createRuntime();
    vi.mocked(runtime.engine.flush).mockResolvedValue({
      sent: 1,
      conflict: false,
      sessionInvalid: false,
      syncVersion: 14,
    });
    const invalidateTrip = vi.fn();
    render(<Harness invalidateTrip={invalidateTrip} runtime={runtime} />);

    await waitFor(() => expect(invalidateTrip).toHaveBeenCalledWith("sydney-2026", 14));
  });
});

function conflictRecord(): OutboxRecord {
  return {
    idempotencyKey: "conflict-key",
    tripId: "sydney-2026",
    mutation: {
      idempotencyKey: "conflict-key",
      entity: "place",
      action: "update",
      entityId: "place-1",
      baseVersion: 1,
      payload: {
        name: "내 장소",
        category: "attraction",
        status: "saved",
        address: null,
        latitude: null,
        longitude: null,
        mapUrl: null,
        sourceUrl: null,
        imageUrl: null,
        description: "",
        savedBy: null
      }
    },
    state: "conflict",
    attempts: 1,
    createdAt: "2026-07-28T10:00:00.000Z",
    lastErrorCode: "VERSION_CONFLICT",
    conflictCurrent: {
      id: "place-1",
      version: 2,
      name: "서버 장소"
    }
  };
}
