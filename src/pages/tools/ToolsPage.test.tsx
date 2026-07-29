import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../app/theme/ThemeProvider";
import type { ToolsViewModel, TripWorkspace } from "../../data/contracts";
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
  return { context, today, schedule, mapPreview, tools };
}

async function renderToolsPage() {
  const workspace = await getWorkspace();
  return render(
    <ThemeProvider>
      <ToolsPage
        tools={workspace.tools}
        workspace={workspace}
        deviceManagement={<p>기기 관리 테스트</p>}
      />
    </ThemeProvider>
  );
}

describe("ToolsPage", () => {
  it("groups every approved tool into the three approved sections", async () => {
    await renderToolsPage();

    expect(screen.getByRole("heading", { name: "Travel Essentials" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Places" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Planning & Settings" })).toBeVisible();
    for (const label of [
      "예약·바우처", "환율", "교통", "비상 연락처", "맛집", "카페", "저장 장소",
      "체크리스트", "여행 메모", "주의사항", "AI 앱 연결", "파트너 연결",
      "연결 기기 관리", "테마", "오프라인·동기화 상태"
    ]) {
      expect(screen.getByRole("heading", { name: label })).toBeVisible();
    }
  });

  it("renders only unavailable features as noninteractive preview articles", async () => {
    await renderToolsPage();

    const transport = screen.getByText("교통").closest("article");
    expect(transport).toHaveTextContent("준비 중");
    expect(transport?.querySelector("button, a, input, select, textarea")).toBeNull();
  });

  it("reuses the existing cards for interactive currency and AI tools", async () => {
    await renderToolsPage();

    const exchange = screen.getByRole("heading", { name: "환율" }).closest("article");
    expect(exchange).not.toHaveTextContent("준비 중");
    expect(screen.getByLabelText("환산 방향")).toBeVisible();
    expect(screen.getByRole("button", { name: "환율 불러오기" })).toBeVisible();

    const ai = screen.getByRole("heading", { name: "AI 앱 연결" }).closest("article");
    expect(ai).not.toHaveTextContent("준비 중");
    expect(screen.getByLabelText("AI 공급자")).toBeVisible();
    expect(screen.getByRole("button", { name: "AI에서 질문하기" })).toBeVisible();
  });

  it("renders the bookings, emergency, device-management, theme, and offline status slots", async () => {
    await renderToolsPage();

    expect(document.getElementById("bookings")).toHaveTextContent("예약·바우처");
    expect(document.getElementById("emergency")).toHaveTextContent("비상 연락처");
    expect(document.getElementById("devices")).toHaveTextContent("기기 관리 테스트");
    expect(screen.getByRole("group", { name: "테마" })).toBeVisible();
    expect(document.querySelector(".offline-banner")).not.toBeInTheDocument();
  });

  it.each(["#bookings", "#exchange", "#ai-connect", "#devices", "#emergency"])("scrolls the approved %s deep link after mount", async (hash) => {
    window.history.replaceState(null, "", `/trip/sydney-2026/tools${hash}`);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });

    await renderToolsPage();

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" }));
  });

  it("does not scroll unsupported hashes", async () => {
    window.history.replaceState(null, "", "/trip/sydney-2026/tools#unknown");
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });

    await renderToolsPage();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("keeps the devices anchor unique when tools are supplied from another source", () => {
    const tools: ToolsViewModel = {
      groups: [{
        id: "planning",
        title: "Planning & Settings",
        items: [{ id: "devices", label: "연결 기기 관리", description: "설명", status: "available" }]
      }],
      tripId: "sydney-2026",
      timeZone: "Australia/Sydney",
      viewerMemberId: "owner",
      members: [],
      places: [],
      bookings: [],
      checkItems: [],
      expenses: [],
      notes: [],
      activity: []
    };
    render(<ThemeProvider><ToolsPage tools={tools} deviceManagement={<p>관리</p>} /></ThemeProvider>);
    expect(document.querySelectorAll("#devices")).toHaveLength(1);
  });
});
