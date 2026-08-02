import { pathForLibrary, pathForTrip } from "./router";

export async function resolveRootStartPath(
  online: boolean,
  latestTripId: () => Promise<string | null>
): Promise<string> {
  if (!online) {
    const tripId = await latestTripId();
    if (tripId) return pathForTrip(tripId, "today");
  }
  return pathForLibrary();
}
