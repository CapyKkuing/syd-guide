import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../app/theme/ThemeProvider";
import type { ToolsViewModel } from "../../data/contracts";
import { createSampleDataSource } from "../../test/travelSamples";
import { ToolsPage } from "./ToolsPage";

async function getTools() {
  const dataSource = createSampleDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const tools = await dataSource.getTools("sydney-2026");
  if (!tools) throw new Error("sample tools missing");
  return tools;
}

async function renderToolsPage() {
  const tools = await getTools();
  return render(
    <ThemeProvider>
      <ToolsPage tools={tools} deviceManagement={<p>기기 관리 테스트</p>} />
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

  it("renders unavailable features as noninteractive preview articles", async () => {
    await renderToolsPage();

    const exchange = screen.getByText("환율").closest("article");
    expect(exchange).not.toBeNull();
    expect(exchange).toHaveTextContent("준비 중");
    expect(exchange?.querySelector("button, a, input, select, textarea")).toBeNull();
    expect(screen.getByText("AI 앱 연결").closest("article")).toHaveTextContent("준비 중");
  });

  it("renders the bookings, emergency, device-management, theme, and offline status slots", async () => {
    await renderToolsPage();

    expect(document.getElementById("bookings")).toHaveTextContent("예약·바우처");
    expect(document.getElementById("emergency")).toHaveTextContent("비상 연락처");
    expect(document.getElementById("devices")).toHaveTextContent("기기 관리 테스트");
    expect(screen.getByRole("group", { name: "테마" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["#bookings", "#devices", "#emergency"])("scrolls the approved %s deep link after mount", async (hash) => {
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
      }]
    };
    render(<ThemeProvider><ToolsPage tools={tools} deviceManagement={<p>관리</p>} /></ThemeProvider>);
    expect(document.querySelectorAll("#devices")).toHaveLength(1);
  });
});
