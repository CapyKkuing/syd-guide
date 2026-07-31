import type { TripWorkspace } from "../../../data/contracts";
import { pathForTool, pathForTrip } from "../../../app/router";

export type SearchKind = "schedule" | "place" | "booking" | "checklist" | "note";
export interface SearchResult {
  id: string;
  kind: SearchKind;
  title: string;
  excerpt: string;
  href: string;
  updatedAt: string;
}

export function searchTrip(workspace: TripWorkspace, query: string, kind: "all" | SearchKind = "all"): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized.length < 2) return [];
  const fallback = workspace.context.trip.updatedAt;
  const results: SearchResult[] = [
    ...workspace.schedule.days.flatMap((day) => day.items.map((item) => ({
      id: item.id,
      kind: "schedule" as const,
      title: item.title,
      excerpt: `${item.place} ${item.description}`,
      href: pathForTrip(workspace.context.trip.id, "schedule"),
      updatedAt: item.updatedAt || fallback
    }))),
    ...workspace.mapPreview.places.map((place) => ({
      id: place.id,
      kind: "place" as const,
      title: place.name,
      excerpt: `${place.address} ${place.description}`,
      href: pathForTrip(workspace.context.trip.id, "map"),
      updatedAt: place.updatedAt || fallback
    })),
    ...workspace.tools.bookings.map((booking) => ({
      id: booking.id,
      kind: "booking" as const,
      title: workspace.tools.places.find((place) => place.id === booking.placeId)?.name || booking.provider,
      excerpt: `${booking.provider} ${booking.bookingType} ${booking.memo}`,
      href: pathForTool(workspace.context.trip.id, "bookings"),
      updatedAt: booking.updatedAt
    })),
    ...workspace.tools.checkItems.map((item) => ({
      id: item.id,
      kind: "checklist" as const,
      title: item.title,
      excerpt: item.memo,
      href: pathForTool(workspace.context.trip.id, "checklist"),
      updatedAt: item.updatedAt
    })),
    ...workspace.tools.notes.map((note) => ({
      id: note.id,
      kind: "note" as const,
      title: note.body.slice(0, 60),
      excerpt: note.body,
      href: pathForTool(workspace.context.trip.id, "notes"),
      updatedAt: note.updatedAt
    }))
  ];

  return results
    .filter((result) => kind === "all" || result.kind === kind)
    .map((result) => ({
      result,
      score: result.title.toLocaleLowerCase().includes(normalized)
        ? result.kind === "booking" ? 3 : 2
        : result.excerpt.toLocaleLowerCase().includes(normalized) ? 1 : 0
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.result.updatedAt.localeCompare(left.result.updatedAt))
    .map(({ result }) => result);
}
