import { useMemo, useSyncExternalStore } from "react";
import {
  APP_BASE_URL,
  pathForApp,
  stripAppBase
} from "./basePath";

export type TripTab = "today" | "schedule" | "map" | "tools";

export const toolRouteIds = [
  "bookings",
  "exchange",
  "transport",
  "emergency",
  "restaurants",
  "cafes",
  "saved-places",
  "checklist",
  "notes",
  "tips",
  "ai-connect",
  "partner-connect",
  "devices",
  "theme",
  "offline-sync",
  "search",
  "activity",
] as const;

export type ToolRouteId = typeof toolRouteIds[number];

function isToolRouteId(value: string): value is ToolRouteId {
  return (toolRouteIds as readonly string[]).includes(value);
}

export type Route =
  | { name: "root" }
  | { name: "library" }
  | { name: "trip"; tripId: string; tab: TripTab; toolId?: ToolRouteId }
  | {
      name: "memories";
      tripId: string;
      view: "editor" | "player";
    }
  | { name: "pair" }
  | { name: "not-found" };

export function parseRoute(pathname: string, baseUrl = APP_BASE_URL): Route {
  const appPath = stripAppBase(pathname, baseUrl);
  if (appPath === null) return { name: "not-found" };
  if (appPath === "/") return { name: "root" };
  if (/^\/library\/?$/.test(appPath)) return { name: "library" };
  if (/^\/pair\/?$/.test(appPath)) return { name: "pair" };

  const memoriesMatch =
    /^\/trip\/([^/]+)\/memories(?:\/(play))?\/?$/.exec(appPath);
  if (memoriesMatch) {
    const encodedTripId = memoriesMatch[1];
    if (!encodedTripId) return { name: "not-found" };
    try {
      return {
        name: "memories",
        tripId: decodeURIComponent(encodedTripId),
        view: memoriesMatch[2] ? "player" : "editor",
      };
    } catch {
      return { name: "not-found" };
    }
  }

  const toolsMatch = /^\/trip\/([^/]+)\/tools(?:\/([^/]+))?\/?$/.exec(appPath);
  if (toolsMatch) {
    const encodedTripId = toolsMatch[1];
    const toolId = toolsMatch[2];
    if (!encodedTripId) return { name: "not-found" };

    try {
      const tripId = decodeURIComponent(encodedTripId);
      if (!toolId) return { name: "trip", tripId, tab: "tools" };
      if (!isToolRouteId(toolId)) return { name: "not-found" };
      return { name: "trip", tripId, tab: "tools", toolId };
    } catch {
      return { name: "not-found" };
    }
  }

  const match = /^\/trip\/([^/]+)\/(today|schedule|map)\/?$/.exec(appPath);
  if (!match) return { name: "not-found" };

  const encodedTripId = match[1];
  const tab = match[2];
  if (!encodedTripId || !tab) return { name: "not-found" };

  try {
    return {
      name: "trip",
      tripId: decodeURIComponent(encodedTripId),
      tab: tab as TripTab,
    };
  } catch {
    return { name: "not-found" };
  }
}

export function pathForLibrary(baseUrl = APP_BASE_URL): string {
  return pathForApp("/library", baseUrl);
}

export function pathForPair(baseUrl = APP_BASE_URL): string {
  return pathForApp("/pair", baseUrl);
}

export function pathForTrip(
  tripId: string,
  tab: TripTab,
  baseUrl = APP_BASE_URL
): string {
  return pathForApp(`/trip/${encodeURIComponent(tripId)}/${tab}`, baseUrl);
}

export function pathForTool(
  tripId: string,
  toolId: ToolRouteId,
  baseUrl = APP_BASE_URL
): string {
  return pathForApp(`/trip/${encodeURIComponent(tripId)}/tools/${toolId}`, baseUrl);
}

export function pathForMemories(
  tripId: string,
  baseUrl = APP_BASE_URL
): string {
  return pathForApp(
    `/trip/${encodeURIComponent(tripId)}/memories`,
    baseUrl
  );
}

export function pathForMemoryPlayer(
  tripId: string,
  baseUrl = APP_BASE_URL
): string {
  return pathForApp(
    `/trip/${encodeURIComponent(tripId)}/memories/play`,
    baseUrl
  );
}

function scrollToHashTarget(path: string): void {
  const hashIndex = path.indexOf("#");
  if (hashIndex < 0) return;

  const hash = path.slice(hashIndex + 1);
  if (!hash) return;

  requestAnimationFrame(() => {
    let id: string;
    try {
      id = decodeURIComponent(hash);
    } catch {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  });
}

export function navigate(path: string, replace = false, baseUrl = APP_BASE_URL): void {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("navigate requires a root-relative app path");
  }
  const appPath = pathForApp(path, baseUrl);
  window.history[replace ? "replaceState" : "pushState"](null, "", appPath);
  window.dispatchEvent(new PopStateEvent("popstate"));
  scrollToHashTarget(appPath);
}

function subscribe(notify: () => void): () => void {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}

function getPathname(): string {
  return window.location.pathname;
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, getPathname, () => "/");
  return useMemo(() => parseRoute(pathname), [pathname]);
}

export function consumePairTokenFromUrl(baseUrl = APP_BASE_URL): string | null {
  if (parseRoute(window.location.pathname, baseUrl).name !== "pair") return null;
  const token = new URL(window.location.href).searchParams.get("token");
  window.history.replaceState(null, "", pathForPair(baseUrl));
  return token;
}

export function navigateToLibrary(): void {
  navigate(pathForLibrary(), true);
}
