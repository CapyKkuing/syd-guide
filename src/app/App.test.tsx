import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureTravelGuideDataSource } from "../data/fixture/fixtureDataSource";
import { createFixturePreviewTripLibraryClient } from "../features/trips/api";
import { App } from "./App";
import { resolveRootStartPath } from "./rootStart";

vi.mock("../features/auth/PairingManager", () => ({
  PairingManager: () => <p>기기 관리 테스트</p>
}));

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("App routing", () => {
  it("opens the latest cached trip when the installed app starts offline", async () => {
    await expect(resolveRootStartPath(false, async () => "trip-one"))
      .resolves.toBe("/trip/trip-one/today");
    await expect(resolveRootStartPath(true, async () => "trip-one"))
      .resolves.toBe("/library");
  });

  it("renders the library at root without trip navigation", async () => {
    window.history.replaceState(null, "", "/");
    render(<App dataSource={fixtureTravelGuideDataSource} />);

    expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
    expect(window.location.pathname).toBe("/library");
    expect(screen.queryByRole("navigation", { name: "여행 메뉴" })).not.toBeInTheDocument();
  });

  it("opens account device management directly from the library", async () => {
    window.history.replaceState(null, "", "/library");
    const preview = createFixturePreviewTripLibraryClient(fixtureTravelGuideDataSource);
    render(
      <App
        tripLibraryClient={{ ...preview, readOnlyReason: undefined }}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "연결 기기" }));

    expect(screen.getByRole("dialog", { name: "연결 기기 관리" }))
      .toHaveTextContent("기기 관리 테스트");
    expect(window.location.pathname).toBe("/library");
  });

  it("opens the selected trip editor from the pre-trip home action", async () => {
    window.history.replaceState(null, "", "/trip/bondi-weekend/today");
    const preview = createFixturePreviewTripLibraryClient(fixtureTravelGuideDataSource);
    render(
      <App
        dataSource={fixtureTravelGuideDataSource}
        tripLibraryClient={{ ...preview, readOnlyReason: undefined }}
      />
    );

    await userEvent.click(
      await screen.findByRole("link", { name: "여행 정보 편집" })
    );

    expect(await screen.findByRole("dialog", { name: "여행 수정" })).toBeVisible();
  });

  it("renders all four trip routes in the TripShell", async () => {
    for (const tab of ["today", "schedule", "map", "tools"] as const) {
      window.history.replaceState(null, "", `/trip/sydney-2026/${tab}`);
      const view = render(<App dataSource={fixtureTravelGuideDataSource} />);

      expect(await screen.findByRole("navigation", { name: "여행 메뉴" })).toBeVisible();
      view.unmount();
    }
  });

  it("preserves the pair route and supplied token", () => {
    window.history.replaceState(null, "", "/pair");
    render(<App pairToken="pair-token" />);

    expect(screen.getByRole("heading", { name: "함께하는 여행에 연결" })).toBeVisible();
    expect(screen.getByRole("button", { name: "기기 연결" })).toBeVisible();
  });

  it("offers a library return action for an unknown trip", async () => {
    window.history.replaceState(null, "", "/trip/missing/today");
    render(<App dataSource={fixtureTravelGuideDataSource} />);

    expect(await screen.findByText("여행을 찾을 수 없습니다")).toBeVisible();
    expect(screen.getByText(/새 여행의 내부 데이터는 다음 단계에서 연결됩니다/))
      .toBeVisible();
    expect(screen.getByRole("button", { name: "여행 서재로 이동" })).toBeVisible();
  });

  it("offers the library from an unknown route", async () => {
    window.history.replaceState(null, "", "/missing");
    render(<App dataSource={fixtureTravelGuideDataSource} />);

    expect(screen.getByRole("heading", { name: "화면을 찾을 수 없습니다" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "여행 서재로 이동" }));
    expect(await screen.findByRole("heading", { name: "여행 서재" })).toBeVisible();
  });
});
