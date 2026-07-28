import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiRequestError,
  type TripInput,
  type TripLibraryClient,
  type TripLibrarySummary
} from "./api";

type Resource =
  | { status: "loading"; trips: TripLibrarySummary[] }
  | { status: "ready"; trips: TripLibrarySummary[] }
  | { status: "error"; trips: TripLibrarySummary[]; error: ApiRequestError };

function normalizedError(error: unknown): ApiRequestError {
  return error instanceof ApiRequestError
    ? error
    : new ApiRequestError(
      0,
      "REQUEST_FAILED",
      error instanceof Error ? error.message : "여행 정보를 불러오지 못했습니다."
    );
}

export function useTripLibrary(client: TripLibraryClient) {
  const [active, setActive] = useState<Resource>({ status: "loading", trips: [] });
  const [trash, setTrash] = useState<Resource>({ status: "loading", trips: [] });
  const [mutationError, setMutationError] = useState<ApiRequestError | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const mounted = useRef(true);
  const activeGeneration = useRef(0);
  const trashGeneration = useRef(0);
  const mutationLock = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeGeneration.current += 1;
      trashGeneration.current += 1;
    };
  }, []);

  const loadActive = useCallback(async (showLoading = true) => {
    const generation = ++activeGeneration.current;
    if (showLoading) setActive((current) => ({ status: "loading", trips: current.trips }));
    try {
      const trips = await client.list("active");
      if (mounted.current && generation === activeGeneration.current) {
        setActive({ status: "ready", trips });
      }
    } catch (error) {
      if (mounted.current && generation === activeGeneration.current) {
        setActive({ status: "error", trips: [], error: normalizedError(error) });
      }
    }
  }, [client]);

  const loadTrash = useCallback(async (showLoading = true) => {
    const generation = ++trashGeneration.current;
    if (showLoading) setTrash((current) => ({ status: "loading", trips: current.trips }));
    try {
      const trips = await client.list("trash");
      if (mounted.current && generation === trashGeneration.current) {
        setTrash({ status: "ready", trips });
      }
    } catch (error) {
      if (mounted.current && generation === trashGeneration.current) {
        setTrash({ status: "error", trips: [], error: normalizedError(error) });
      }
    }
  }, [client]);

  const refreshActiveSilently = useCallback(async () => {
    const generation = ++activeGeneration.current;
    try {
      const trips = await client.list("active");
      if (mounted.current && generation === activeGeneration.current) {
        setActive({ status: "ready", trips });
      }
    } catch {
      // A conflict refresh must not replace usable library data with a global error.
    }
  }, [client]);

  const refreshTrashSilently = useCallback(async () => {
    const generation = ++trashGeneration.current;
    try {
      const trips = await client.list("trash");
      if (mounted.current && generation === trashGeneration.current) {
        setTrash({ status: "ready", trips });
      }
    } catch {
      // Keep the existing trash panel usable when a background refresh fails.
    }
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadActive();
    });
    return () => {
      cancelled = true;
    };
  }, [loadActive]);

  const mutate = useCallback(async (
    operation: () => Promise<unknown>,
    refreshTrash: boolean
  ): Promise<boolean> => {
    if (mutationLock.current || client.readOnlyReason) return false;
    mutationLock.current = true;
    setIsMutating(true);
    setMutationError(null);
    try {
      await operation();
      if (!mounted.current) return false;
      await loadActive(false);
      if (refreshTrash) await loadTrash(false);
      return mounted.current;
    } catch (error) {
      const requestError = normalizedError(error);
      if (mounted.current) setMutationError(requestError);
      if (mounted.current && requestError.code === "VERSION_CONFLICT") {
        await Promise.all([
          refreshActiveSilently(),
          ...(refreshTrash ? [refreshTrashSilently()] : [])
        ]);
      }
      return false;
    } finally {
      mutationLock.current = false;
      if (mounted.current) setIsMutating(false);
    }
  }, [
    client,
    loadActive,
    loadTrash,
    refreshActiveSilently,
    refreshTrashSilently
  ]);

  return {
    active,
    trash,
    mutationError,
    isMutating,
    readOnlyReason: client.readOnlyReason,
    clearMutationError: () => setMutationError(null),
    retryActive: () => void loadActive(),
    loadTrash: () => void loadTrash(),
    create: (input: TripInput) =>
      mutate(() => client.create(input), false),
    update: (trip: TripLibrarySummary, input: TripInput) =>
      mutate(() => client.update(trip.id, input, trip.version), false),
    moveToTrash: (trip: TripLibrarySummary) =>
      mutate(() => client.trash(trip.id, trip.version), true),
    restore: (trip: TripLibrarySummary) =>
      mutate(() => client.restore(trip.id, trip.version), true)
  };
}
