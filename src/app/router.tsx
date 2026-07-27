import { useSyncExternalStore } from "react";

export type Page = "library" | "today" | "schedule" | "places" | "more";

function currentPage(): Page {
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
      return () => window.removeEventListener("hashchange", notify);
    },
    currentPage,
    () => "library"
  );
}
