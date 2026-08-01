import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ToolRouteId } from "../../app/router";
import { ThemeProvider } from "../../app/theme/ThemeProvider";
import type { TripWorkspace } from "../../data/contracts";
import { createSampleDataSource } from "../../test/travelSamples";
import { ToolsPage } from "./ToolsPage";

async function getWorkspace(): Promise<TripWorkspace> {
  const dataSource = createSampleDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const [context, today, schedule, mapPreview, tools] = await Promise.all([
    dataSource.getTripContext("sydney-2026"),
    dataSource.getToday("sydney-2026"),
    dataSource.getSchedule("sydney-2026"),
    dataSource.getMapPreview("sydney-2026"),
    dataSource.getTools("sydney-2026")
  ]);
  if (!context || !today || !schedule || !mapPreview || !tools) {
    throw new Error("sample workspace missing");
  }
  return {
    context,
    today,
    schedule,
    mapPreview,
    tools,
    media: [],
    mediaStorage: null,
  };
}

async function renderToolsPage(activeToolId?: ToolRouteId) {
  const workspace = await getWorkspace();
  return render(
    <ThemeProvider>
      <ToolsPage
        activeToolId={activeToolId}
        tools={workspace.tools}
        workspace={workspace}
        deviceManagement={<p>기기 관리 테스트</p>}
      />
    </ThemeProvider>
  );
}

describe("ToolsPage", () => {
  it("shows links to every tool without rendering their full panels on the hub", async () => {
    await renderToolsPage();

    expect(screen.getByRole("heading", { name: "도구" })).toBeVisible();
    for (const link of screen.getAllByRole("link", { name: "예약·바우처 열기" })) {
      expect(link).toHaveAttribute("href", "/trip/sydney-2026/tools/bookings");
    }
    for (const link of screen.getAllByRole("link", { name: "여행 검색 열기" })) {
      expect(link).toHaveAttribute("href", "/trip/sydney-2026/tools/search");
    }
    expect(screen.getByRole("heading", { name: "Travel Essentials" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Places" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Planning & Settings" })).toBeVisible();
    for (const label of [
      "예약·바우처", "환율", "교통", "비상 연락처", "맛집", "카페", "저장 장소",
      "체크리스트", "여행 메모", "주의사항", "AI 앱 연결", "참여자 연결",
      "연결 기기 관리", "테마", "오프라인·동기화 상태"
    ]) {
      expect(screen.getAllByRole("link", { name: `${label} 열기` })[0]).toBeVisible();
    }
    expect(screen.queryByLabelText("환산 방향")).not.toBeInTheDocument();
    expect(screen.queryByText("기기 관리 테스트")).not.toBeInTheDocument();
  });

  it("opens an available tool as a standalone detail page", async () => {
    await renderToolsPage("exchange");

    expect(screen.getByRole("link", { name: "← 도구" })).toHaveAttribute(
      "href",
      "/trip/sydney-2026/tools"
    );
    expect(screen.getByRole("heading", { level: 1, name: "환율" })).toBeVisible();
    expect(screen.getByLabelText("환산 방향")).toBeVisible();
    expect(screen.getByRole("button", { name: "환율 불러오기" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Travel Essentials" })).not.toBeInTheDocument();
  });

  it("opens an unavailable tool on its own prepared-state page", async () => {
    await renderToolsPage("transport");

    expect(screen.getByRole("heading", { level: 1, name: "교통" })).toBeVisible();
    expect(screen.getByText("준비 중")).toBeVisible();
    expect(screen.getByText("교통 안내는 준비 중입니다.")).toBeVisible();
  });

  it("renders device management only on the devices route", async () => {
    await renderToolsPage("devices");

    expect(screen.getByRole("heading", { level: 1, name: "연결 기기 관리" })).toBeVisible();
    expect(screen.getByText("기기 관리 테스트")).toBeVisible();
  });

  it("renders search and activity as standalone tools", async () => {
    const search = await renderToolsPage("search");

    expect(screen.getByRole("heading", { level: 1, name: "여행 검색" })).toBeVisible();
    expect(screen.getByLabelText("검색어")).toBeVisible();

    search.unmount();
    await renderToolsPage("activity");
    expect(screen.getByRole("heading", { level: 1, name: "최근 활동" })).toBeVisible();
    expect(screen.getByRole("button", { name: "활동 새로고침" })).toBeVisible();
  });

  it("keeps a preview badge on unavailable tool links", async () => {
    await renderToolsPage();

    expect(screen.getByRole("link", { name: "교통 열기" })).toHaveTextContent("준비 중");
  });
});
