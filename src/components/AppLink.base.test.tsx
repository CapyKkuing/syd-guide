import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  window.history.replaceState(null, "", "/");
});

describe("AppLink under a configured app base", () => {
  it("emits and navigates a root-relative app route beneath the base", async () => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const { AppLink } = await import("./AppLink");

    render(<AppLink href="/library">여행 서재</AppLink>);
    const link = screen.getByRole("link", { name: "여행 서재" });

    expect(link).toHaveAttribute("href", "/syd-guide/library");
    fireEvent.click(link);
    expect(window.location.pathname).toBe("/syd-guide/library");
  });

  it("does not double-prefix an already based app route", async () => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const { AppLink } = await import("./AppLink");

    render(<AppLink href="/syd-guide/trip/sydney-2026/today">시드니</AppLink>);

    expect(screen.getByRole("link", { name: "시드니" }))
      .toHaveAttribute("href", "/syd-guide/trip/sydney-2026/today");
  });

  it.each([
    ["/syd-guide#emergency", "/syd-guide/#emergency"],
    ["/syd-guide?from=link#emergency", "/syd-guide/?from=link#emergency"],
    [
      "/syd-guide/library?filter=active#top",
      "/syd-guide/library?filter=active#top"
    ]
  ])("preserves exact and already-based AppLink suffixes for %s", async (href, expected) => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const { AppLink } = await import("./AppLink");

    render(<AppLink href={href}>안전한 링크</AppLink>);
    const link = screen.getByRole("link", { name: "안전한 링크" });

    expect(link).toHaveAttribute("href", expected);
    fireEvent.click(link);
    expect(
      window.location.pathname === "/syd-guide/"
      || window.location.pathname.startsWith("/syd-guide/")
    ).toBe(true);
  });

  it.each([
    "/../library?from=link#target",
    "/%2e%2e/library?from=link#target",
    "/%2E%2e/library?from=link#target",
    "/syd-guide/../library?from=link#target",
    "/syd-guide/.%2E/library?from=link#target",
    "/syd-guide\\..\\library?from=link#target"
  ])("cannot navigate an adversarial AppLink outside the base: %s", async (href) => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const { AppLink } = await import("./AppLink");

    render(<AppLink href={href}>검증 링크</AppLink>);
    const link = screen.getByRole("link", { name: "검증 링크" });

    expect(link).toHaveAttribute("href", "/syd-guide/?from=link#target");
    fireEvent.click(link);
    expect(window.location.pathname).toBe("/syd-guide/");
    expect(window.location.search).toBe("?from=link");
    expect(window.location.hash).toBe("#target");
  });

  it("keeps double-encoded dot text literal and inside the base", async () => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const { AppLink } = await import("./AppLink");

    render(
      <AppLink href="/%252E%252e/library?from=double#target">
        이중 인코딩 링크
      </AppLink>
    );
    const link = screen.getByRole("link", { name: "이중 인코딩 링크" });

    expect(link)
      .toHaveAttribute(
        "href",
        "/syd-guide/%252E%252e/library?from=double#target"
      );
    fireEvent.click(link);
    expect(window.location.pathname).toBe("/syd-guide/%252E%252e/library");
  });

  it("preserves a valid reserved-character trip route under the base", async () => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const [{ AppLink }, { pathForTrip }] = await Promise.all([
      import("./AppLink"),
      import("../app/router")
    ]);
    const href = pathForTrip("서울 / 東京?#%", "tools");

    render(<AppLink href={href}>예약 도구</AppLink>);
    const link = screen.getByRole("link", { name: "예약 도구" });

    expect(link)
      .toHaveAttribute(
        "href",
        "/syd-guide/trip/%EC%84%9C%EC%9A%B8%20%2F%20%E6%9D%B1%E4%BA%AC%3F%23%25/tools"
      );
    fireEvent.click(link);
    expect(window.location.pathname)
      .toBe("/syd-guide/trip/%EC%84%9C%EC%9A%B8%20%2F%20%E6%9D%B1%E4%BA%AC%3F%23%25/tools");
  });

  it("keeps an external AppLink unchanged under the configured base", async () => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const { AppLink } = await import("./AppLink");

    render(
      <AppLink href="https://example.test/library" onClick={(event) => event.preventDefault()}>
        외부 링크
      </AppLink>
    );

    expect(screen.getByRole("link", { name: "외부 링크" }))
      .toHaveAttribute("href", "https://example.test/library");
  });

  it("emits fixture cover assets beneath the configured base", async () => {
    vi.stubEnv("BASE_URL", "/syd-guide/");
    const { FixtureTravelGuideDataSource } = await import("../data/fixture/fixtureDataSource");
    const dataSource = new FixtureTravelGuideDataSource(
      () => new Date("2026-07-28T00:00:00.000Z")
    );

    const trips = await dataSource.listTrips();

    expect(trips.map((trip) => trip.coverImageUrl)).toEqual([
      "/syd-guide/images/sydney_harbour_bridge.jpg",
      "/syd-guide/images/bondi_beach.jpg",
      "/syd-guide/images/blue_mountains.jpg"
    ]);
  });
});
