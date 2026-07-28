import { render, screen } from "@testing-library/react";
import { act } from "react";
import { vi } from "vitest";
import { OfflineBanner } from "./OfflineBanner";
import { StatusPanel } from "./StatusPanel";

describe("StatusPanel", () => {
  it("reserves a distinct session-expired recovery state", () => {
    render(
      <StatusPanel
        kind="session-expired"
        title="세션이 만료되었습니다"
        description="작성 중인 내용은 이 화면에 보존됩니다."
        action={{ label: "다시 로그인", onClick: vi.fn() }}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("세션이 만료되었습니다");
    expect(screen.getByText("작성 중인 내용은 이 화면에 보존됩니다.")).toBeVisible();
    expect(screen.getByRole("button", { name: "다시 로그인" })).toBeVisible();
  });

  it("uses a polite live status for loading", () => {
    render(<StatusPanel kind="loading" title="불러오는 중" description="여행 정보를 준비합니다." />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("renders non-urgent empty states without an alert role", () => {
    render(<StatusPanel kind="not-found" title="여행을 찾을 수 없습니다" description="서재에서 다시 선택하세요." />);

    expect(screen.getByRole("heading", { name: "여행을 찾을 수 없습니다" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("invokes its supplied action", () => {
    const onClick = vi.fn();
    render(
      <StatusPanel
        kind="error"
        title="불러오지 못했습니다"
        description="다시 시도하세요."
        action={{ label: "다시 시도", onClick }}
      />
    );

    screen.getByRole("button", { name: "다시 시도" }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("OfflineBanner", () => {
  it("follows browser online and offline events", () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByRole("status")).toHaveTextContent("오프라인 — 저장된 샘플 정보를 표시합니다");

    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders immediately when the browser is already offline", () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });

    try {
      render(<OfflineBanner />);
      expect(screen.getByRole("status")).toHaveTextContent("오프라인 — 저장된 샘플 정보를 표시합니다");
    } finally {
      if (original) Object.defineProperty(window.navigator, "onLine", original);
      else Reflect.deleteProperty(window.navigator, "onLine");
    }
  });

  it("removes both browser listeners when unmounted", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const view = render(<OfflineBanner />);
    const onlineHandler = addEventListener.mock.calls.find(([type]) => type === "online")?.[1];
    const offlineHandler = addEventListener.mock.calls.find(([type]) => type === "offline")?.[1];

    view.unmount();

    expect(onlineHandler).toEqual(expect.any(Function));
    expect(offlineHandler).toEqual(expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("online", onlineHandler);
    expect(removeEventListener).toHaveBeenCalledWith("offline", offlineHandler);
  });
});
