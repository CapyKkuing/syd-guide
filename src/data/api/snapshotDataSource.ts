import {
  isAdminAccessCode,
  isAdminAccessError,
  type SessionPrincipal,
} from "../../features/auth/api";
import type { TripSnapshot } from "../../shared/api";
import type { ApiClient, SnapshotResult } from "../../services/api/client";
import { ApiClientError } from "../../services/api/errors";
import type { SnapshotStore } from "../../services/offline/snapshotStore";
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
import type { MutationRequest, SyncMutationRequest } from "../../shared/mutations";

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
  private readonly snapshots?: SnapshotStore;
  private readonly onSessionInvalid: () => void | Promise<void>;

  constructor(
    client: Pick<ApiClient, "getTripSnapshot">,
    principalLoader: () => Promise<SessionPrincipal>,
    clock: () => Date = () => new Date(),
    offline: {
      snapshots: SnapshotStore;
      onSessionInvalid?: () => void | Promise<void>;
    } | undefined = undefined
  ) {
    this.client = client;
    this.principalLoader = principalLoader;
    this.clock = clock;
    this.snapshots = offline?.snapshots;
    this.onSessionInvalid = offline?.onSessionInvalid ?? (() => undefined);
  }

  async listTrips(): Promise<TripSummaryViewModel[]> {
    return [];
  }

  async applyLocalMutation(
    tripId: string,
    mutation: SyncMutationRequest,
    updatedAt: string
  ): Promise<void> {
    if (!isScheduleItemUpdate(mutation)) return;
    const cached = this.cache.get(tripId);
    const durable = cached?.snapshot ? undefined : await this.snapshots?.get(tripId);
    const snapshot = cached?.snapshot ?? durable?.snapshot;
    if (!snapshot) return;
    const current = snapshot.scheduleItems.find((item) => item.id === mutation.entityId);
    if (!current || current.version !== mutation.baseVersion) return;
    const nextSnapshot = {
      ...snapshot,
      scheduleItems: snapshot.scheduleItems.map((item) => item.id === mutation.entityId
        ? {
            ...item,
            ...mutation.payload,
            version: item.version + 1,
            updatedAt,
          }
        : item),
    };
    const etag = cached?.etag ?? durable?.etag ?? null;
    this.cache.set(tripId, { snapshot: nextSnapshot, etag, workspace: null });
    await this.snapshots?.put({ tripId, snapshot: nextSnapshot, etag, savedAt: updatedAt });
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
    const durable = await this.snapshots?.get(tripId);
    let principal: SessionPrincipal | null = null;
    let principalError: unknown;
    try {
      principal = await this.loadPrincipal();
    } catch (error) {
      principalError = error;
    }
    let result;
    try {
      result = await this.loadFreshSnapshot(
        tripId,
        cached?.etag ?? durable?.etag ?? undefined,
        cached?.snapshot ?? durable?.snapshot ?? null
      );
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        if (isAdminAccessCode(error.code)) throw error;
        await Promise.all([
          this.snapshots?.clear(),
          this.snapshots?.clearPrincipal()
        ]);
        await this.onSessionInvalid();
        throw error;
      }
      if (!canUseOfflineSnapshot(error)) throw error;
      const snapshot = cached?.snapshot ?? durable?.snapshot;
      if (!snapshot) {
        if (isAdminAccessError(principalError)) throw principalError;
        throw new Error(
          "오프라인 저장 정보가 없습니다. 온라인에서 여행을 한 번 열어 주세요.",
          { cause: error }
        );
      }
      const workspace = mapSnapshotToWorkspace(snapshot, principal, this.clock());
      this.cache.set(tripId, {
        snapshot,
        etag: cached?.etag ?? durable?.etag ?? null,
        workspace
      });
      return workspace;
    }
    if (!principal) {
      throw principalError ?? new Error("사용자 정보를 불러오지 못했습니다.");
    }
    const snapshot = result.notModified
      ? cached?.snapshot ?? durable?.snapshot ?? null
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
    await this.snapshots?.put({
      tripId,
      snapshot,
      etag: result.etag,
      savedAt: now.toISOString()
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
      const principal = await this.principalLoader();
      await this.snapshots?.savePrincipal(principal);
      return principal;
    } catch (error) {
      const principal = await this.snapshots?.getPrincipal();
      if (principal) return principal;
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

function canUseOfflineSnapshot(error: unknown): boolean {
  return error instanceof TypeError
    || (error instanceof ApiClientError && error.status === 503);
}

function isScheduleItemUpdate(
  mutation: SyncMutationRequest
): mutation is MutationRequest<"schedule_item"> & { action: "update"; payload: NonNullable<MutationRequest<"schedule_item">["payload"]> } {
  return mutation.entity === "schedule_item"
    && mutation.action === "update"
    && mutation.payload !== null;
}
