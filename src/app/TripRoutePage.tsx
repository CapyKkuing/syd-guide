import type {
  TravelGuideDataSource,
  TripSummaryViewModel,
} from "../data/contracts";
import { useTripWorkspace } from "../data/useTravelData";
import { TripShell } from "../layouts/TripShell";
import { StatusPanel } from "../components/StatusPanel";
import {
  navigateToLibrary,
  navigate,
  pathForMemories,
  pathForMemoryPlayer,
  pathForTrip,
  type ToolRouteId,
  type TripTab,
} from "./router";
import { useTripSwitcherFocus } from "./TripSwitcherFocus";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TodayPage } from "../pages/today/TodayPage";
import { SchedulePage } from "../pages/schedule/SchedulePage";
import { MapPage } from "../pages/map/MapPage";
import { ToolsPage } from "../pages/tools/ToolsPage";
import { PairingManager } from "../features/auth/PairingManager";
import {
  getAdminLoginUrl,
  isAdminAccessCode,
} from "../features/auth/api";
import type { MutableTravelGuideDataSource } from "../data/contracts";
import {
  createTripMutationController,
  type MutationTransport
} from "../services/mutations/controller";
import { SyncProvider } from "../services/sync/SyncProvider";
import type { MediaApi } from "../services/media/api";
import type { MediaStorageProviderClient } from "../services/media/provider";
import type { MediaThumbnailStore } from "../services/offline/mediaThumbnailStore";
import { ReelEditor } from "../features/memories/reel/ReelEditor";
import {
  defaultReelStore,
} from "../features/memories/reel/reelStore";
import type { TravelReel } from "../features/memories/reel/types";
import { ReelPlayer } from "../features/memories/player/ReelPlayer";
import { AppLink } from "../components/AppLink";
import type { TripMedia } from "../shared/media";

export function TripRoutePage({
  dataSource,
  mutationTransport,
  mediaApi,
  mediaProvider,
  mediaThumbnailStore,
  tripId,
  activeTab,
  toolId,
  memoryView,
}: {
  dataSource: TravelGuideDataSource;
  mutationTransport?: MutationTransport;
  mediaApi?: MediaApi;
  mediaProvider?: MediaStorageProviderClient;
  mediaThumbnailStore?: MediaThumbnailStore;
  tripId: string;
  activeTab: TripTab;
  toolId?: ToolRouteId;
  memoryView?: "editor" | "player";
}) {
  const workspace = useTripWorkspace(dataSource, tripId);
  const mutableDataSource = isMutableDataSource(dataSource) ? dataSource : null;
  const hasVerifiedIdentity =
    workspace.status === "ready"
    && workspace.data.context.viewer.access === "full";
  const mutationController = useMemo(
    () => hasVerifiedIdentity && mutableDataSource && mutationTransport
      ? createTripMutationController({
        tripId,
        transport: mutationTransport,
        dataSource: mutableDataSource,
        reload: workspace.reload
      })
      : undefined,
    [
      hasVerifiedIdentity,
      mutableDataSource,
      mutationTransport,
      tripId,
      workspace.reload
    ]
  );
  const { intentTripId, clearFocusRestoration } = useTripSwitcherFocus();

  useEffect(() => {
    if (!intentTripId || workspace.status === "loading") return;
    if (intentTripId !== tripId || workspace.status === "empty" || workspace.status === "error") {
      clearFocusRestoration();
    }
  }, [clearFocusRestoration, intentTripId, tripId, workspace.status]);

  useEffect(() => {
    document.scrollingElement?.scrollTo?.({ top: 0, behavior: "auto" });
    document.getElementById("trip-content")?.scrollTo?.({ top: 0, behavior: "auto" });
  }, [activeTab, toolId]);

  let page: ReactNode;
  if (workspace.status === "loading") {
    page = <StatusPanel kind="loading" title="여행 정보를 불러오는 중" description="잠시만 기다려 주세요." />;
  } else if (workspace.status === "error") {
    page = isAdminAccessCode(workspace.code) ? (
      <StatusPanel
        action={{ label: "관리자 다시 로그인", href: getAdminLoginUrl() }}
        description="Cloudflare Access 로그인을 다시 진행하면 원래 여행 화면으로 돌아옵니다."
        kind="session-expired"
        title="관리자 로그인이 필요합니다"
      />
    ) : (
      <StatusPanel kind="error" title="여행 정보를 불러오지 못했습니다" description={workspace.message} action={{ label: "다시 시도", onClick: workspace.retry }} />
    );
  } else if (workspace.status === "empty") {
    page = <StatusPanel kind="not-found" title="여행을 찾을 수 없습니다" description="새 여행의 내부 데이터는 다음 단계에서 연결됩니다. 기존 여행이라면 여행 서재에서 다시 선택해 주세요." action={{ label: "여행 서재로 이동", onClick: navigateToLibrary }} />;
  } else {
    page = memoryView ? (
      <MemoryRoutePage
        api={hasVerifiedIdentity ? mediaApi : undefined}
        media={workspace.data.media}
        onMediaChanged={workspace.reload}
        provider={mediaProvider}
        thumbnailStore={mediaThumbnailStore}
        trip={workspace.data.context.trip}
        view={memoryView}
      />
    ) : (
      <TripShell context={workspace.data.context} activeTab={activeTab} activeToolId={toolId}>
        {activeTab === "today" ? (
          <section aria-labelledby="trip-today-title">
            <h1 id="trip-today-title" className="today-route-title">오늘</h1>
            <TodayPage
              bookings={workspace.data.tools.bookings}
              checkItems={workspace.data.tools.checkItems}
              media={workspace.data.media}
              mediaApi={hasVerifiedIdentity ? mediaApi : undefined}
              mediaProvider={mediaProvider}
              mediaStorage={workspace.data.mediaStorage}
              mediaThumbnailStore={mediaThumbnailStore}
              members={workspace.data.tools.members}
              settlementTransfers={workspace.data.tools.settlementTransfers ?? []}
              mutationController={mutationController}
              onMediaChanged={workspace.reload}
              today={workspace.data.today}
              trip={workspace.data.context.trip}
              viewerMemberId={workspace.data.context.viewer.memberId}
              viewerRole={workspace.data.context.viewer.role}
            />
          </section>
        ) : activeTab === "map" ? (
          <MapPage
            days={workspace.data.schedule.days}
            mutationController={mutationController}
            places={workspace.data.mapPreview.places}
            tripId={tripId}
            viewerMemberId={workspace.data.context.viewer.memberId}
          />
        ) : activeTab === "schedule" ? (
          <SchedulePage
            days={workspace.data.schedule.days}
            mutationController={mutationController}
            places={workspace.data.mapPreview.places}
            timeZone={workspace.data.context.trip.timeZone}
            tripId={tripId}
            viewerMemberId={workspace.data.context.viewer.memberId}
          />
        ) : (
          <ToolsPage
            activeToolId={toolId}
            deviceManagement={mutationTransport && hasVerifiedIdentity
              ? <PairingManager />
              : <p>읽기 전용 미리보기에서는 기기를 관리할 수 없습니다.</p>}
            mutationController={mutationController}
            mediaApi={hasVerifiedIdentity ? mediaApi : undefined}
            mediaProvider={mediaProvider}
            reload={workspace.reload}
            tools={workspace.data.tools}
            workspace={workspace.data}
          />
        )}
      </TripShell>
    );
  }

  return mutableDataSource ? (
    <SyncProvider
      dataSource={mutableDataSource}
      reload={workspace.reload}
      tripId={tripId}
    >
      {page}
    </SyncProvider>
  ) : page;
}

function MemoryRoutePage({
  api,
  media,
  onMediaChanged,
  provider,
  thumbnailStore,
  trip,
  view,
}: {
  api?: MediaApi;
  media: TripMedia[];
  onMediaChanged?: () => void | Promise<void>;
  provider?: MediaStorageProviderClient;
  thumbnailStore?: MediaThumbnailStore;
  trip: TripSummaryViewModel;
  view: "editor" | "player";
}) {
  if (view === "player") {
    return (
      <MemoryPlayerRoute
        key={trip.id}
        media={media}
        provider={provider}
        thumbnailStore={thumbnailStore}
        trip={trip}
      />
    );
  }

  return (
    <main className="memory-route-page">
      <header className="memory-route-page__header">
        <div>
          <p>MEMORY REEL</p>
          <h1>{trip.title} 사진 릴</h1>
        </div>
        <nav aria-label="추억 릴 이동">
          <AppLink href={pathForTrip(trip.id, "today")}>오늘로 돌아가기</AppLink>
          <AppLink
            className="primary-button"
            href={pathForMemoryPlayer(trip.id)}
          >
            세로 화면으로 재생
          </AppLink>
        </nav>
      </header>
      <ReelEditor
        api={api}
        media={media}
        onMediaChanged={onMediaChanged}
        provider={provider}
        store={defaultReelStore}
        thumbnailStore={thumbnailStore}
        tripId={trip.id}
      />
    </main>
  );
}

function MemoryPlayerRoute({
  media,
  provider,
  thumbnailStore,
  trip,
}: {
  media: TripMedia[];
  provider?: MediaStorageProviderClient;
  thumbnailStore?: MediaThumbnailStore;
  trip: TripSummaryViewModel;
}) {
  const [reel, setReel] = useState<TravelReel | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void defaultReelStore.get(trip.id).then(
      (saved) => {
        if (active) setReel(saved);
      },
      () => {
        if (!active) return;
        setReel(null);
        setLoadFailed(true);
      }
    );
    return () => {
      active = false;
    };
  }, [trip.id]);

  if (reel === undefined) {
    return (
      <StatusPanel
        kind="loading"
        title="사진 릴을 불러오는 중"
        description="기기에 저장된 편집 결과를 확인하고 있습니다."
      />
    );
  }
  if (!reel?.scenes.length) {
    return (
      <StatusPanel
        kind={loadFailed ? "error" : "not-found"}
        title={loadFailed ? "사진 릴을 불러오지 못했습니다" : "재생할 사진 릴이 없습니다"}
        description={
          loadFailed
            ? "기기 저장소를 확인한 뒤 다시 시도해 주세요."
            : "편집 화면에서 사진 릴을 먼저 만들어 주세요."
        }
        action={{
          label: "릴 편집으로 이동",
          onClick: () => navigate(pathForMemories(trip.id)),
        }}
      />
    );
  }

  return (
    <ReelPlayer
      editHref={pathForMemories(trip.id)}
      exitHref={pathForTrip(trip.id, "today")}
      media={media}
      provider={provider}
      reel={reel}
      thumbnailStore={thumbnailStore}
      tripId={trip.id}
      tripTitle={trip.title}
    />
  );
}

function isMutableDataSource(
  dataSource: TravelGuideDataSource
): dataSource is MutableTravelGuideDataSource {
  return "invalidateTrip" in dataSource
    && typeof dataSource.invalidateTrip === "function";
}
