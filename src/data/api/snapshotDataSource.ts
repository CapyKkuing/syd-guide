import {
  isAdminAccessCode,
  type SessionPrincipal,
} from "../../features/auth/api";
import type { TripSnapshot } from "../../shared/api";
import type { ApiClient, SnapshotResult } from "../../services/api/client";
import { ApiClientError } from "../../services/api/errors";
import type {
  MapPreviewViewModel,
  MutableTravelGuideDataSource,
  ScheduleViewModel,
  TodayViewModel,
  ToolsViewModel,
  TripContextViewModel,
  TripSummaryViewModel,
  TripWorkspace
} from "../contracts";
import { mapSnapshotToWorkspace } from "./snapshotMappers";
import type { TripMedia, TripMediaStorage } from "../../shared/media";

const ONLINE_LOAD_ERROR =
  "인터넷 연결이 필요합니다. 연결을 확인한 뒤 다시 시도해 주세요.";

type CacheEntry = {
  snapshot: TripSnapshot | null;
  etag: string | null;
  workspace: TripWorkspace | null;
};

export class SnapshotTravelGuideDataSource implements MutableTravelGuideDataSource {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<TripWorkspace | null>>();
  private readonly minimumSyncVersions = new Map<string, number>();
  private readonly client: Pick<ApiClient, "getTripSnapshot">;
  private readonly principalLoader: () => Promise<SessionPrincipal>;
  private readonly clock: () => Date;
  private readonly onSessionInvalid: () => void | Promise<void>;

  constructor(
    client: Pick<ApiClient, "getTripSnapshot">,
    principalLoader: () => Promise<SessionPrincipal>,
    clock: () => Date = () => new Date(),
    options: {
      onSessionInvalid?: () => void | Promise<void>;
    } | undefined = undefined
  ) {
    this.client = client;
    this.principalLoader = principalLoader;
    this.clock = clock;
    this.onSessionInvalid = options?.onSessionInvalid ?? (() => undefined);
  }

  async listTrips(): Promise<TripSummaryViewModel[]> {
    return [];
  }

  invalidateTrip(tripId: string, minimumSyncVersion?: number): void {
    const current = this.cache.get(tripId);
    if (current) this.cache.set(tripId, { ...current, workspace: null });
    this.pending.delete(tripId);
    if (minimumSyncVersion !== undefined && minimumSyncVersion >= 0) {
      this.minimumSyncVersions.set(
        tripId,
        Math.max(minimumSyncVersion, this.minimumSyncVersions.get(tripId) ?? -1)
      );
    }
  }

  async getTripContext(tripId: string): Promise<TripContextViewModel | null> {
    return (await this.workspace(tripId))?.context ?? null;
  }

  async getToday(tripId: string): Promise<TodayViewModel | null> {
    return (await this.workspace(tripId))?.today ?? null;
  }

  async getSchedule(tripId: string): Promise<ScheduleViewModel | null> {
    return (await this.workspace(tripId))?.schedule ?? null;
  }

  async getMapPreview(tripId: string): Promise<MapPreviewViewModel | null> {
    return (await this.workspace(tripId))?.mapPreview ?? null;
  }

  async getTools(tripId: string): Promise<ToolsViewModel | null> {
    return (await this.workspace(tripId))?.tools ?? null;
  }

  async getMedia(tripId: string): Promise<TripMedia[]> {
    return (await this.workspace(tripId))?.media ?? [];
  }

  async getMediaStorage(tripId: string): Promise<TripMediaStorage | null> {
    return (await this.workspace(tripId))?.mediaStorage ?? null;
  }

  private workspace(tripId: string): Promise<TripWorkspace | null> {
    const cached = this.cache.get(tripId);
    if (cached?.workspace) return Promise.resolve(cached.workspace);
    const current = this.pending.get(tripId);
    if (current) return current;
    const request = this.load(tripId).finally(() => this.pending.delete(tripId));
    this.pending.set(tripId, request);
    return request;
  }

  private async load(tripId: string): Promise<TripWorkspace | null> {
    const cached = this.cache.get(tripId);
    const principal = await this.loadPrincipal();
    let result;
    try {
      result = await this.loadFreshSnapshot(
        tripId,
        cached?.etag ?? undefined,
        cached?.snapshot ?? null
      );
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        if (isAdminAccessCode(error.code)) throw error;
        await this.onSessionInvalid();
        throw error;
      }
      if (error instanceof TypeError
        || (error instanceof ApiClientError && error.status === 503)) {
        throw new Error(ONLINE_LOAD_ERROR, { cause: error });
      }
      throw error;
    }
    const snapshot = result.notModified
      ? cached?.snapshot ?? null
      : result.snapshot;
    if (!snapshot) {
      if (result.notModified) throw new Error("저장된 여행 snapshot이 없습니다.");
      this.cache.set(tripId, {
        snapshot: null,
        etag: result.etag,
        workspace: null
      });
      return null;
    }
    const now = this.clock();
    const workspace = mapSnapshotToWorkspace(snapshot, principal, now);
    this.minimumSyncVersions.delete(tripId);
    this.cache.set(tripId, {
      snapshot,
      etag: result.etag,
      workspace
    });
    return workspace;
  }

  private async loadFreshSnapshot(
    tripId: string,
    etag: string | undefined,
    fallbackSnapshot: TripSnapshot | null
  ): Promise<SnapshotResult> {
    const minimumSyncVersion = this.minimumSyncVersions.get(tripId);
    let result = await this.client.getTripSnapshot(tripId, etag);
    if (minimumSyncVersion === undefined
      || snapshotSyncVersion(result, fallbackSnapshot) >= minimumSyncVersion) {
      return result;
    }
    for (const delay of [50, 100, 200, 400]) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      result = await this.client.getTripSnapshot(tripId, undefined);
      if (snapshotSyncVersion(result, fallbackSnapshot) >= minimumSyncVersion) {
        return result;
      }
    }
    throw new Error("최신 변경사항을 불러오지 못했습니다. 다시 시도해 주세요.");
  }

  private async loadPrincipal(): Promise<SessionPrincipal> {
    try {
      return await this.principalLoader();
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(ONLINE_LOAD_ERROR, { cause: error });
      }
      throw error;
    }
  }
}

function snapshotSyncVersion(
  result: SnapshotResult,
  fallbackSnapshot: TripSnapshot | null
): number {
  return result.notModified
    ? fallbackSnapshot?.syncVersion ?? -1
    : result.snapshot?.syncVersion ?? Number.MAX_SAFE_INTEGER;
}
