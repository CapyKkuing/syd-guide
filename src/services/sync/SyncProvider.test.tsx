import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "../../components/OfflineBanner";
import type { MutableTravelGuideDataSource } from "../../data/contracts";
import { SyncProvider } from "./SyncProvider";

function Harness({
  children,
  invalidateTrip = vi.fn(),
  pollIntervalMs,
  reload = vi.fn(),
}: {
  children?: ReactNode;
  invalidateTrip?: MutableTravelGuideDataSource["invalidateTrip"];
  pollIntervalMs?: number;
  reload?: () => void;
}) {
  return (
    <SyncProvider
      dataSource={{ invalidateTrip }}
      pollIntervalMs={pollIntervalMs}
      reload={reload}
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
  it("blocks the trip surface while the device is offline", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });

    try {
      render(<Harness><p>여행 화면</p></Harness>);

      expect(await screen.findByRole("heading", { name: "인터넷 연결이 필요합니다" }))
        .toBeVisible();
      expect(screen.queryByText("여행 화면")).not.toBeInTheDocument();
    } finally {
      if (descriptor) Object.defineProperty(window.navigator, "onLine", descriptor);
      else Reflect.deleteProperty(window.navigator, "onLine");
    }
  });

  it("checks the latest server state on start and every five seconds", async () => {
    vi.useFakeTimers();
    const invalidateTrip = vi.fn();
    const reload = vi.fn();
    const view = render(
      <Harness invalidateTrip={invalidateTrip} reload={reload} />
    );

    await act(async () => undefined);
    expect(invalidateTrip).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(invalidateTrip).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(2);

    view.unmount();
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(invalidateTrip).toHaveBeenCalledTimes(2);
  });

  it("checks again when connectivity, focus, or visibility returns", async () => {
    const onlineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const invalidateTrip = vi.fn();

    try {
      render(<Harness invalidateTrip={invalidateTrip} />);
      expect(invalidateTrip).not.toHaveBeenCalled();

      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
      act(() => window.dispatchEvent(new Event("online")));
      await waitFor(() => expect(invalidateTrip).toHaveBeenCalledTimes(1));

      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      await waitFor(() => expect(invalidateTrip).toHaveBeenCalledTimes(2));

      act(() => window.dispatchEvent(new Event("focus")));
      await waitFor(() => expect(invalidateTrip).toHaveBeenCalledTimes(3));
    } finally {
      if (onlineDescriptor) {
        Object.defineProperty(window.navigator, "onLine", onlineDescriptor);
      } else {
        Reflect.deleteProperty(window.navigator, "onLine");
      }
      if (visibilityDescriptor) {
        Object.defineProperty(document, "visibilityState", visibilityDescriptor);
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
    }
  });

  it("shows online status and lets the user request an immediate refresh", async () => {
    const invalidateTrip = vi.fn();
    render(<Harness invalidateTrip={invalidateTrip} />);

    await waitFor(() => expect(invalidateTrip).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("온라인 자동 동기화");

    await userEvent.click(screen.getByRole("button", { name: "최신 내용 확인" }));
    expect(invalidateTrip).toHaveBeenCalledTimes(2);
  });
});
