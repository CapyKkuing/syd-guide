import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    expect(screen.queryByRole("heading", { name: "Places" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planning" })).toBeVisible();
    for (const label of [
      "예약·바우처", "환율", "교통", "비상 연락처",
      "체크리스트", "여행 메모", "주의사항", "AI 앱 연결"
    ]) {
      expect(screen.getAllByRole("link", { name: `${label} 열기` })[0]).toBeVisible();
    }
    for (const label of ["맛집", "카페", "저장 장소"]) {
      expect(screen.queryByRole("link", { name: `${label} 열기` })).not.toBeInTheDocument();
    }
    for (const label of ["참여자 연결", "초대·기기 관리", "테마", "오프라인·동기화 상태"]) {
      expect(screen.queryByRole("link", { name: `${label} 열기` })).not.toBeInTheDocument();
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

  it("opens transport with live references and saved transport places", async () => {
    await renderToolsPage("transport");

    expect(screen.getByRole("heading", { level: 1, name: "교통" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "공식 실시간 정보" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Transport NSW 여행 계획 공식 화면 열기" })).toHaveAttribute(
      "href",
      "https://transportnsw.info/plan"
    );
    expect(screen.getByRole("button", { name: "장소 추가" })).toBeDisabled();
  });

  it("opens emergency contacts and offline travel tips", async () => {
    const online = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    try {
      const emergency = await renderToolsPage("emergency");
      expect(screen.getByRole("heading", { level: 1, name: "비상 연락처" })).toBeVisible();
      expect(screen.getAllByRole("link", { name: "000 전화" })[0]).toHaveAttribute("href", "tel:000");
      expect(screen.getByText("Meriton Sussex Street")).toBeVisible();

      emergency.unmount();
      await renderToolsPage("tips");
      expect(screen.getByRole("heading", { level: 1, name: "주의사항" })).toBeVisible();
      expect(screen.getByRole("heading", { name: "교통카드" })).toBeVisible();
      expect(screen.getByRole("link", { name: "비상 연락처 열기" })).toHaveAttribute(
        "href",
        "/trip/sydney-2026/tools/emergency"
      );
    } finally {
      if (online) Object.defineProperty(window.navigator, "onLine", online);
      else Reflect.deleteProperty(window.navigator, "onLine");
    }
  });

  it("collects admin-only settings on the management route", async () => {
    await renderToolsPage("devices");

    expect(screen.getByRole("heading", { level: 1, name: "관리" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "참여자·초대·기기" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "화면 설정" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "오프라인·동기화" })).toBeVisible();
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

  it("marks every required traveler tool as available", async () => {
    await renderToolsPage();

    for (const label of ["교통", "비상 연락처", "주의사항"]) {
      expect(screen.getByRole("link", { name: `${label} 열기` })).not.toHaveTextContent("준비 중");
    }
  });
});
