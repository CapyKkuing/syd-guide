import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDependencies } from "../auth/access";
import { requirePrincipal } from "../auth/principal";
import { idSchema } from "../db/entity-registry";
import { loadTripSnapshot } from "../db/snapshot";
import type { AppEnv } from "../env";
import {
  applyMutation,
  MutationError,
} from "../services/mutations";

export class SyncError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

function validTripId(value: string): string {
  if (!idSchema.safeParse(value).success) {
    throw new SyncError(
      400,
      "TRIP_ID_INVALID",
      "여행 ID가 올바르지 않습니다."
    );
  }
  return value;
}

function storageError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (
    /quota|free tier|limit|exceeded maximum|too many|temporar(?:y|ily)|unavailable/i
      .test(message)
  ) {
    throw new SyncError(
      503,
      "D1_UNAVAILABLE",
      "무료 한도 또는 일시적인 저장소 오류로 요청을 처리하지 못했습니다."
    );
  }
  throw new SyncError(
    500,
    "SYNC_STORAGE_ERROR",
    "동기화 저장소 요청을 처리하지 못했습니다."
  );
}

export function registerSyncRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies
) {
  app.get("/api/trips/:id/snapshot", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = validTripId(c.req.param("id"));
    try {
      const snapshot = await loadTripSnapshot(
        c.env,
        tripId,
        principal.memberId
      );
      if (!snapshot) {
        throw new SyncError(
          404,
          "TRIP_NOT_FOUND",
          "여행을 찾을 수 없습니다."
        );
      }
      const etag = `"trip-${snapshot.trip.id}-${snapshot.syncVersion}"`;
      c.header("Cache-Control", "private, must-revalidate");
      c.header("ETag", etag);
      if (c.req.header("If-None-Match") === etag) {
        return c.body(null, 304);
      }
      return c.json(snapshot);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      storageError(error);
    }
  });

  app.post("/api/trips/:id/mutations", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = validTripId(c.req.param("id"));
    const input = await c.req.json().catch(() => null);
    try {
      return c.json(
        await applyMutation(
          c.env,
          tripId,
          principal,
          input,
          dependencies.now()
        )
      );
    } catch (error) {
      if (error instanceof MutationError) throw error;
      storageError(error);
    }
  });
}
