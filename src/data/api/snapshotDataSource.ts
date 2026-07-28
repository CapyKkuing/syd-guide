import type { SessionPrincipal } from "../../features/auth/api";
import type { TripSnapshot } from "../../shared/api";
import type { ApiClient } from "../../services/api/client";
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

type CacheEntry = {
  snapshot: TripSnapshot | null;
  etag: string | null;
  workspace: TripWorkspace | null;
};

export class SnapshotTravelGuideDataSource implements MutableTravelGuideDataSource {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<TripWorkspace | null>>();
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

  invalidateTrip(tripId: string): void {
    const current = this.cache.get(tripId);
    if (current) this.cache.set(tripId, { ...current, workspace: null });
    this.pending.delete(tripId);
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
    const principal = await this.loadPrincipal();
    let result;
    try {
      result = await this.client.getTripSnapshot(
        tripId,
        cached?.etag ?? durable?.etag ?? undefined
      );
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
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

function canUseOfflineSnapshot(error: unknown): boolean {
  return error instanceof TypeError
    || (error instanceof ApiClientError && error.status === 503);
}
