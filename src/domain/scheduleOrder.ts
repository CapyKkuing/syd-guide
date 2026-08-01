import type { MapPlaceView, ScheduleItemView } from "../data/contracts";

export function orderScheduleItems(items: ScheduleItemView[]): ScheduleItemView[] {
  return [...items].sort((left, right) =>
    left.position - right.position
    || left.startsAt.localeCompare(right.startsAt)
    || left.id.localeCompare(right.id)
  );
}

export function moveScheduleItem(
  items: ScheduleItemView[],
  sourceId: string,
  targetId: string
): ScheduleItemView[] {
  const ordered = [...items];
  const sourceIndex = ordered.findIndex((item) => item.id === sourceId);
  const targetIndex = ordered.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ordered;
  const [moved] = ordered.splice(sourceIndex, 1);
  if (!moved) return ordered;
  ordered.splice(targetIndex, 0, moved);
  return ordered;
}

export function placesInScheduleOrder(
  items: ScheduleItemView[],
  places: MapPlaceView[]
): MapPlaceView[] {
  const placesById = new Map(places.map((place) => [place.id, place]));
  const added = new Set<string>();
  return items.flatMap((item) => {
    if (!item.placeId || added.has(item.placeId)) return [];
    const place = placesById.get(item.placeId);
    if (!place) return [];
    added.add(place.id);
    return [place];
  });
}
