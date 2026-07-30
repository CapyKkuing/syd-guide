import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { navigate, type TripTab } from "../app/router";
import { ThemeProvider } from "../app/theme/ThemeProvider";
import { FixtureTravelGuideDataSource } from "../data/fixture/fixtureDataSource";
import { TripShell } from "./TripShell";

const layoutStyles = readFileSync("src/styles/layout.css", "utf8")
  .replace(/\r\n/g, "\n");
const navigationStyles = readFileSync("src/styles/navigation.css", "utf8")
  .replace(/\r\n/g, "\n");

async function renderTripShell(
  activeTab: TripTab,
  partnerStatus: "connected" | "not-connected" = "connected",
  tripId = "sydney-2026"
) {
  const dataSource = new FixtureTravelGuideDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const context = await dataSource.getTripContext(tripId);
  if (!context) throw new Error("fixture context missing");

  return render(
    <ThemeProvider>
      <TripShell context={{ ...context, partnerStatus }} activeTab={activeTab}>
        <p>여행 내용</p>
      </TripShell>
    </ThemeProvider>
  );
}

describe("TripShell", () => {
  it.each([
    ["bondi-weekend", "DAY 01"],
    ["sydney-2026", "DAY 02"],
    ["blue-mountains-memory", "DAY 04"]
  ] as const)("shows the phase-aware display day for %s", async (tripId, expectedDay) => {
    await renderTripShell("today", "connected", tripId);

    expect(screen.getByRole("button", { name: "여행 전환" }))
      .toHaveTextContent(expectedDay);
  });

  it("renders four navigable trip tabs and marks only the active tab current", async () => {
    await renderTripShell("today");

    const nav = screen.getByRole("navigation", { name: "여행 메뉴" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(within(nav).getByRole("link", { name: "오늘" }))
      .toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "일정" }))
      .not.toHaveAttribute("aria-current");
    expect(screen.getByRole("status", { name: "파트너 연결됨" })).toBeVisible();
  });

  it.each([
    ["connected", "파트너 연결됨", "연결됨"],
    ["not-connected", "파트너 연결 필요", "연결 필요"]
  ] as const)("renders distinct desktop and mobile copy for a %s partner state", async (partnerStatus, desktopCopy, mobileCopy) => {
    await renderTripShell("today", partnerStatus);

    const status = screen.getByRole("status", { name: desktopCopy });
    const desktopLabel = within(status).getByText(desktopCopy);
    const mobileLabel = within(status).getByText(mobileCopy);

    expect(status).toHaveAttribute("aria-label", desktopCopy);
    expect(desktopLabel).toHaveClass("partner-status__desktop");
    expect(mobileLabel).toHaveClass("partner-status__mobile");
    expect(desktopLabel).toHaveAttribute("aria-hidden", "true");
    expect(mobileLabel).toHaveAttribute("aria-hidden", "true");
  });

  it("uses deterministic desktop and mobile partner-status visibility rules", () => {
    const mobileRules = layoutStyles.split("@media (max-width: 620px)")[1]?.split("@media")[0];

    expect(layoutStyles).toMatch(/\.partner-status__desktop\s*\{[^}]*display: inline;/);
    expect(layoutStyles).toMatch(/\.partner-status__mobile\s*\{[^}]*display: none;/);
    expect(mobileRules).toMatch(/\.partner-status__desktop\s*\{[^}]*display: none;/);
    expect(mobileRules).toMatch(/\.partner-status__mobile\s*\{[^}]*display: inline;/);
    expect(mobileRules).not.toMatch(/\.partner-status__(desktop|mobile)\s*\{[^}]*?(clip:|position: absolute)/);
  });

  it.each([
    { viewport: 320, expectedMenuWidth: 288, expectedLeft: 16, expectedRight: 304 },
    { viewport: 390, expectedMenuWidth: 320, expectedLeft: 54, expectedRight: 374 },
    { viewport: 430, expectedMenuWidth: 320, expectedLeft: 94, expectedRight: 414 }
  ])("contains the switcher menu within a $viewport px viewport", ({
    viewport,
    expectedMenuWidth,
    expectedLeft,
    expectedRight
  }) => {
    const menuRule = ruleFor(layoutStyles, ".trip-switcher-menu");
    const narrowStyles = layoutStyles
      .split("@media (max-width: 620px)")[1]
      ?.split("@media")[0] ?? "";
    const narrowMenuRule = ruleFor(narrowStyles, ".trip-switcher-menu");

    expect(menuRule).toContain("width: min(320px, calc(100vw - 32px));");
    expect(menuRule).toContain("min-width: 0;");
    expect(narrowMenuRule).toContain("right: 0;");
    expect(narrowMenuRule).toContain("left: auto;");

    const headerInset = 16;
    const menuWidth = Math.min(320, viewport - headerInset * 2);
    const right = viewport - headerInset;
    const left = right - menuWidth;

    expect({ menuWidth, left, right }).toEqual({
      menuWidth: expectedMenuWidth,
      left: expectedLeft,
      right: expectedRight
    });
    expect(left).toBeGreaterThanOrEqual(headerInset);
    expect(right).toBeLessThanOrEqual(viewport - headerInset);
  });

  it("keeps the trip switcher trigger and menu items at least 44px tall", () => {
    expect(ruleFor(
      layoutStyles,
      ".trip-header__back,\n.trip-switcher-trigger"
    )).toContain("min-height: 44px;");
    expect(ruleFor(layoutStyles, ".trip-switcher-menu__item"))
      .toContain("min-height: 44px;");
  });

  it("gives mobile navigation its own grid row instead of covering trip content", () => {
    const desktopNavigation = navigationStyles.split("@media (min-width: 761px)")[1] ?? "";

    expect(ruleFor(layoutStyles, ".trip-shell")).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(layoutStyles).toMatch(/\.trip-content\s*\{[^}]*overflow-y: auto;/);
    expect(ruleFor(navigationStyles, ".trip-navigation")).toContain("position: static;");
    expect(ruleFor(desktopNavigation, ".trip-navigation")).toContain("position: fixed;");
  });

  it("lists every trip in its switcher and restores trigger focus after Escape", async () => {
    await renderTripShell("schedule");

    const trigger = screen.getByRole("button", { name: "여행 전환" });
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /본다이 주말/ }))
      .toHaveAttribute("href", "/trip/bondi-weekend/today");
    expect(screen.getByRole("link", { name: "시드니 여행" })).toBeVisible();
    expect(screen.getByRole("link", { name: "블루 마운틴 추억" })).toBeVisible();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: /본다이 주말/ })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the switcher from an outside click", async () => {
    await renderTripShell("map");

    await userEvent.click(screen.getByRole("button", { name: "여행 전환" }));
    expect(screen.getByRole("link", { name: /블루 마운틴 추억/ })).toBeVisible();

    await userEvent.click(screen.getByText("여행 내용"));
    expect(screen.queryByRole("link", { name: /블루 마운틴 추억/ })).not.toBeInTheDocument();
  });

  it("restores focus to the destination switcher after selecting a different trip", async () => {
    window.history.replaceState(null, "", "/trip/sydney-2026/today");
    const dataSource = new FixtureTravelGuideDataSource(
      () => new Date("2026-07-28T00:00:00.000Z")
    );
    render(<App dataSource={dataSource} />);

    await screen.findByText(/SYDNEY · DAY 02/);
    await userEvent.click(screen.getByRole("button", { name: "여행 전환" }));
    await userEvent.click(screen.getByRole("link", { name: "본다이 주말" }));

    expect(window.location.pathname).toBe("/trip/bondi-weekend/today");
    await screen.findByText(/BONDI BEACH · DAY 01/);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "여행 전환" })).toHaveFocus();
    });
  });

  it("does not retain switcher focus intent for a modifier-clicked trip", async () => {
    window.history.replaceState(null, "", "/trip/sydney-2026/today");
    const dataSource = new FixtureTravelGuideDataSource(
      () => new Date("2026-07-28T00:00:00.000Z")
    );
    render(<App dataSource={dataSource} />);

    await screen.findByText(/SYDNEY · DAY 02/);
    const sourceTrigger = screen.getByRole("button", { name: "여행 전환" });
    await userEvent.click(sourceTrigger);
    fireEvent.click(screen.getByRole("link", { name: "본다이 주말" }), { ctrlKey: true });

    expect(window.location.pathname).toBe("/trip/sydney-2026/today");
    expect(sourceTrigger).toHaveAttribute("aria-expanded", "true");

    act(() => navigate("/trip/bondi-weekend/today"));
    await screen.findByText(/BONDI BEACH · DAY 01/);
    expect(screen.getByRole("button", { name: "여행 전환" })).not.toHaveFocus();
  });
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

function ruleFor(styles: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`(?:^|\\n)\\s*${escaped} \\{([\\s\\S]*?)\\n\\s*\\}`));
  if (!match?.[1]) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}
