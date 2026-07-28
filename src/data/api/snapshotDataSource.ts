import type { SessionPrincipal } from "../../features/auth/api";
import type { TripSnapshot } from "../../shared/api";
import type { ApiClient } from "../../services/api/client";
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

  constructor(
    client: Pick<ApiClient, "getTripSnapshot">,
    principalLoader: () => Promise<SessionPrincipal>,
    clock: () => Date = () => new Date()
  ) {
    this.client = client;
    this.principalLoader = principalLoader;
    this.clock = clock;
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
    const [result, principal] = await Promise.all([
      this.client.getTripSnapshot(tripId, cached?.etag ?? undefined),
      this.principalLoader()
    ]);
    const snapshot = result.notModified ? cached?.snapshot ?? null : result.snapshot;
    if (!snapshot) {
      if (result.notModified) throw new Error("저장된 여행 snapshot이 없습니다.");
      this.cache.set(tripId, {
        snapshot: null,
        etag: result.etag,
        workspace: null
      });
      return null;
    }
    const workspace = mapSnapshotToWorkspace(snapshot, principal, this.clock());
    this.cache.set(tripId, {
      snapshot,
      etag: result.etag,
      workspace
    });
    return workspace;
  }
}
