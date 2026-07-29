import { useCallback, useEffect, useState } from "react";
import type {
  MutableTravelGuideDataSource,
  TravelGuideDataSource,
  TripSummaryViewModel,
  TripWorkspace,
  TripWorkspaceResource
} from "./contracts";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "empty"; retry: () => void }
  | { status: "error"; message: string; retry: () => void };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "여행 정보를 불러오지 못했습니다.";
}

export function useTravelLibrary(
  dataSource: TravelGuideDataSource
): Loadable<TripSummaryViewModel[]> {
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [resource, setResource] = useState(() => ({
    dataSource,
    value: { status: "loading" } as Loadable<TripSummaryViewModel[]>
  }));
  const retry = useCallback(() => {
    setResource({ dataSource, value: { status: "loading" } });
    setRetryGeneration((generation) => generation + 1);
  }, [dataSource]);

  useEffect(() => {
    let cancelled = false;
    dataSource
      .listTrips()
      .then((trips) => {
        if (cancelled) return;
        setResource({
          dataSource,
          value: trips.length === 0 ? { status: "empty", retry } : { status: "ready", data: trips }
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResource({ dataSource, value: { status: "error", message: errorMessage(error), retry } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataSource, retry, retryGeneration]);

  return resource.dataSource === dataSource ? resource.value : { status: "loading" };
}

export function useTripWorkspace(
  dataSource: TravelGuideDataSource,
  tripId: string
): TripWorkspaceResource {
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [resource, setResource] = useState(() => ({
    dataSource,
    tripId,
    value: { status: "loading" } as Loadable<TripWorkspace>
  }));
  const reload = useCallback(() => {
    if (isMutableDataSource(dataSource)) dataSource.invalidateTrip(tripId);
    setResource({ dataSource, tripId, value: { status: "loading" } });
    setRetryGeneration((generation) => generation + 1);
  }, [dataSource, tripId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      dataSource.getTripContext(tripId),
      dataSource.getToday(tripId),
      dataSource.getSchedule(tripId),
      dataSource.getMapPreview(tripId),
      dataSource.getTools(tripId),
      dataSource.getMedia?.(tripId) ?? Promise.resolve([]),
      dataSource.getMediaStorage?.(tripId) ?? Promise.resolve(null)
    ])
      .then(([context, today, schedule, mapPreview, tools, media, mediaStorage]) => {
        if (cancelled) return;
        if (!context || !today || !schedule || !mapPreview || !tools) {
          setResource({ dataSource, tripId, value: { status: "empty", retry: reload } });
          return;
        }
        setResource({
          dataSource,
          tripId,
          value: {
            status: "ready",
            data: { context, today, schedule, mapPreview, tools, media, mediaStorage }
          }
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResource({ dataSource, tripId, value: { status: "error", message: errorMessage(error), retry: reload } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataSource, reload, retryGeneration, tripId]);

  const value = resource.dataSource === dataSource && resource.tripId === tripId
    ? resource.value
    : { status: "loading" };
  return { ...value, reload } as TripWorkspaceResource;
}

function isMutableDataSource(
  dataSource: TravelGuideDataSource
): dataSource is MutableTravelGuideDataSource {
  return "invalidateTrip" in dataSource
    && typeof dataSource.invalidateTrip === "function";
}
