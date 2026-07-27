import { useSyncExternalStore } from "react";

export type Page =
  | "library"
  | "today"
  | "schedule"
  | "places"
  | "more"
  | "pair";

function currentPage(): Page {
  if (window.location.pathname === "/pair") return "pair";
  const page = window.location.hash.slice(2);

  switch (page) {
    case "today":
    case "schedule":
    case "places":
    case "more":
      return page;
    default:
      return "library";
  }
}

export function usePage(): Page {
  return useSyncExternalStore<Page>(
    (notify) => {
      window.addEventListener("hashchange", notify);
      window.addEventListener("popstate", notify);
      return () => {
        window.removeEventListener("hashchange", notify);
        window.removeEventListener("popstate", notify);
      };
    },
    currentPage,
    () => "library"
  );
}

export function consumePairTokenFromUrl() {
  if (window.location.pathname !== "/pair") return null;
  const token = new URL(window.location.href).searchParams.get("token");
  window.history.replaceState(null, "", "/pair");
  return token;
}

export function navigateToLibrary() {
  window.history.replaceState(null, "", "/library");
  window.dispatchEvent(new PopStateEvent("popstate"));
}
