import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLink } from "../components/AppLink";
import {
  navigate,
  parseRoute,
  pathForLibrary,
  pathForPair,
  pathForTrip,
  useRoute
} from "./router";
import { pathForApp, pathForAsset } from "./basePath";

function RouteProbe() {
  const route = useRoute();
  if (route.name !== "trip") return <span>{route.name}</span>;
  return <span>{`${route.name}/${route.tripId}/${route.tab}`}</span>;
}

function RouteTarget() {
  const route = useRoute();
  return route.name === "trip" && route.tab === "tools"
    ? <div data-testid="devices-target" id="devices">기기 관리</div>
    : null;
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("path routing", () => {
  it.each([
    ["/", { name: "root" }],
    ["/library", { name: "library" }],
    ["/trip/sydney-2026/today", { name: "trip", tripId: "sydney-2026", tab: "today" }],
    ["/trip/sydney-2026/schedule", { name: "trip", tripId: "sydney-2026", tab: "schedule" }],
    ["/trip/sydney-2026/map", { name: "trip", tripId: "sydney-2026", tab: "map" }],
    ["/trip/sydney-2026/tools", { name: "trip", tripId: "sydney-2026", tab: "tools" }],
    ["/pair", { name: "pair" }],
  ])("parses %s", (pathname, expected) => {
    expect(parseRoute(pathname)).toEqual(expected);
  });

  it.each([
    ["/library/", { name: "library" }],
    ["/pair/", { name: "pair" }],
    ["/trip/sydney-2026/today/", { name: "trip", tripId: "sydney-2026", tab: "today" }],
  ])("allows one trailing slash on %s", (pathname, expected) => {
    expect(parseRoute(pathname)).toEqual(expected);
  });

  it.each([
    "//",
    "//library",
    "/library//",
    "//pair",
    "/pair//",
    "//trip/sydney-2026/today",
    "/trip//sydney-2026/today",
    "/trip/sydney-2026//today",
    "/trip/sydney-2026/today//",
  ])("rejects doubled slashes in %s", (pathname) => {
    expect(parseRoute(pathname)).toEqual({ name: "not-found" });
  });

  it("round-trips encoded trip IDs", () => {
    expect(pathForTrip("시드니 / 2026", "tools")).toBe("/trip/%EC%8B%9C%EB%93%9C%EB%8B%88%20%2F%202026/tools");
    expect(parseRoute("/trip/%EC%8B%9C%EB%93%9C%EB%8B%88%20%2F%202026/tools")).toEqual({
      name: "trip",
      tripId: "시드니 / 2026",
      tab: "tools",
    });
  });

  it.each([
    ["/syd-guide", "/syd-guide/", { name: "root" }],
    ["/syd-guide/", "/syd-guide/", { name: "root" }],
    ["/syd-guide/library", "/syd-guide/", { name: "library" }],
    ["/syd-guide/library/", "/syd-guide", { name: "library" }],
    [
      "/syd-guide/trip/%EC%8B%9C%EB%93%9C%EB%8B%88%20%2F%202026/tools",
      "/syd-guide/",
      { name: "trip", tripId: "시드니 / 2026", tab: "tools" }
    ],
    ["/syd-guide/pair/", "/syd-guide/", { name: "pair" }]
  ])("parses %s only after stripping the exact %s base", (pathname, base, expected) => {
    expect(parseRoute(pathname, base)).toEqual(expected);
  });

  it.each([
    "/",
    "/library",
    "/syd-guide-other/library",
    "/syd-guidebook/library",
    "/syd-guide//library"
  ])("rejects paths outside or malformed beneath the configured base: %s", (pathname) => {
    expect(parseRoute(pathname, "/syd-guide/")).toEqual({ name: "not-found" });
  });

  it("builds base-aware app, route, and asset paths without double-prefixing", () => {
    expect(pathForLibrary("/syd-guide/")).toBe("/syd-guide/library");
    expect(pathForPair("/syd-guide/")).toBe("/syd-guide/pair");
    expect(pathForTrip("서울 / 東京?#", "map", "/syd-guide/"))
      .toBe("/syd-guide/trip/%EC%84%9C%EC%9A%B8%20%2F%20%E6%9D%B1%E4%BA%AC%3F%23/map");
    expect(pathForApp("/trip/sydney-2026/tools#devices", "/syd-guide/"))
      .toBe("/syd-guide/trip/sydney-2026/tools#devices");
    expect(pathForApp("/syd-guide/trip/sydney-2026/tools#devices", "/syd-guide/"))
      .toBe("/syd-guide/trip/sydney-2026/tools#devices");
    expect(pathForAsset("images/sydney.jpg", "/syd-guide/"))
      .toBe("/syd-guide/images/sydney.jpg");
  });

  it.each([
    ["/syd-guide#emergency", "/syd-guide/#emergency"],
    ["/syd-guide?from=today#emergency", "/syd-guide/?from=today#emergency"],
    [
      "/syd-guide/library?filter=active#top",
      "/syd-guide/library?filter=active#top"
    ],
    [
      "/library?return=%2Ftrip%2Fsydney%23today#top?panel=quick",
      "/syd-guide/library?return=%2Ftrip%2Fsydney%23today#top?panel=quick"
    ],
    [
      "/syd-guide/%252e%252e/library?case=double#safe",
      "/syd-guide/%252e%252e/library?case=double#safe"
    ],
    [
      "/%252E%252e/library?case=double#safe",
      "/syd-guide/%252E%252e/library?case=double#safe"
    ]
  ])("preserves structural search and hash suffixes in base-safe href %s", (href, expected) => {
    const result = pathForApp(href, "/syd-guide/");

    expect(result).toBe(expected);
    const observedPathname = new URL(result, "https://example.test").pathname;
    expect(observedPathname === "/syd-guide/" || observedPathname.startsWith("/syd-guide/"))
      .toBe(true);
  });

  it.each([
    ["/../library", "/syd-guide/"],
    ["/./library?from=raw#target", "/syd-guide/?from=raw#target"],
    ["/%2e%2e/library?from=encoded#target", "/syd-guide/?from=encoded#target"],
    ["/%2E%2e/library", "/syd-guide/"],
    ["/.%2E/library", "/syd-guide/"],
    ["/syd-guide/../library", "/syd-guide/"],
    ["/syd-guide/%2e%2E/library?from=based#target", "/syd-guide/?from=based#target"],
    ["/syd-guide/%2E./library", "/syd-guide/"],
    ["/syd-guide\\..\\library?from=backslash#target", "/syd-guide/?from=backslash#target"]
  ])("canonicalizes browser-normalized dot-segment href %s inside the base", (href, expected) => {
    const result = pathForApp(href, "/syd-guide/");

    expect(result).toBe(expected);
    expect(new URL(result, "https://example.test").pathname).toBe("/syd-guide/");
  });

  it("preserves a valid encoded trip ID with reserved and Unicode characters under the base", () => {
    const result = pathForTrip("서울 / 東京?#%", "tools", "/syd-guide/");

    expect(result)
      .toBe("/syd-guide/trip/%EC%84%9C%EC%9A%B8%20%2F%20%E6%9D%B1%E4%BA%AC%3F%23%25/tools");
    expect(new URL(result, "https://example.test").pathname)
      .toBe("/syd-guide/trip/%EC%84%9C%EC%9A%B8%20%2F%20%E6%9D%B1%E4%BA%AC%3F%23%25/tools");
  });

  it.each([
    "/../library?from=navigate#target",
    "/%2E%2e/library?from=navigate#target",
    "/syd-guide/%2e%2E/library?from=navigate#target",
    "/syd-guide\\..\\library?from=navigate#target"
  ])("keeps navigate inside the configured base for adversarial href %s", (href) => {
    window.history.replaceState(null, "", "/syd-guide/start");

    act(() => navigate(href, false, "/syd-guide/"));

    expect(window.location.pathname).toBe("/syd-guide/");
    expect(window.location.search).toBe("?from=navigate");
    expect(window.location.hash).toBe("#target");
  });

  it("canonicalizes an exact-base navigate while preserving its suffix", () => {
    window.history.replaceState(null, "", "/syd-guide/start");

    act(() => navigate("/syd-guide?from=navigate#emergency", false, "/syd-guide/"));

    expect(window.location.pathname).toBe("/syd-guide/");
    expect(window.location.search).toBe("?from=navigate");
    expect(window.location.hash).toBe("#emergency");
  });

  it.each([
    () => `//${window.location.host}/library?from=network`,
    () => `${window.location.origin}/library?from=absolute`
  ])("rejects non-root-relative navigate inputs before History can leave the base", (href) => {
    window.history.replaceState(null, "", "/syd-guide/start");

    expect(() => navigate(href(), false, "/syd-guide/"))
      .toThrow("navigate requires a root-relative app path");
    expect(window.location.pathname).toBe("/syd-guide/start");
    expect(window.location.search).toBe("");
  });

  it("marks unknown paths and malformed trip IDs as not found", () => {
    expect(parseRoute("/unknown")).toEqual({ name: "not-found" });
    expect(parseRoute("/trip/%E0%A4%A/today")).toEqual({ name: "not-found" });
  });

  it("uses History navigation for an internal AppLink", async () => {
    window.history.replaceState(null, "", "/library");
    render(
      <>
        <AppLink href="/trip/sydney-2026/today">시드니 여행</AppLink>
        <RouteProbe />
      </>
    );
    await userEvent.click(screen.getByRole("link", { name: "시드니 여행" }));
    expect(screen.getByText("trip/sydney-2026/today")).toBeVisible();
  });

  it.each([
    ["external", { href: "https://example.com/trip" }, {}],
    ["new-tab", { href: "/trip/sydney-2026/today", target: "_blank" }, {}],
    ["download", { href: "/trip/sydney-2026/today", download: "guide.pdf" }, {}],
    ["Alt click", { href: "/trip/sydney-2026/today" }, { altKey: true }],
    ["Meta click", { href: "/trip/sydney-2026/today" }, { metaKey: true }],
    ["Shift click", { href: "/trip/sydney-2026/today" }, { shiftKey: true }],
    ["Ctrl click", { href: "/trip/sydney-2026/today" }, { ctrlKey: true }],
    ["middle click", { href: "/trip/sydney-2026/today" }, { button: 1 }],
  ])("preserves browser defaults for %s AppLinks", (_name, props, eventInit) => {
    const defaultPreventedBeforeHandlers: boolean[] = [];
    const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
      defaultPreventedBeforeHandlers.push(event.defaultPrevented);
      event.preventDefault();
    };
    render(<AppLink {...props} onClick={onClick}>기본 동작</AppLink>);

    fireEvent.click(screen.getByRole("link", { name: "기본 동작" }), eventInit);
    expect(defaultPreventedBeforeHandlers).toEqual([false]);
    expect(window.location.pathname).toBe("/");
  });

  it("scrolls to a hash target after its route renders", async () => {
    const scrollIntoView = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<RouteTarget />);
      expect(screen.queryByTestId("devices-target")).not.toBeInTheDocument();

      act(() => navigate("/trip/sydney-2026/tools#devices"));

      expect(await screen.findByTestId("devices-target")).toBeVisible();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });
});
