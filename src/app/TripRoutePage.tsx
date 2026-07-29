import type { TravelGuideDataSource } from "../data/contracts";
import { useTripWorkspace } from "../data/useTravelData";
import { TripShell } from "../layouts/TripShell";
import { StatusPanel } from "../components/StatusPanel";
import { navigateToLibrary, type TripTab } from "./router";
import { useTripSwitcherFocus } from "./TripSwitcherFocus";
import { useEffect, useMemo, type ReactNode } from "react";
import { TodayPage } from "../pages/today/TodayPage";
import { SchedulePage } from "../pages/schedule/SchedulePage";
import { MapPage } from "../pages/map/MapPage";
import { ToolsPage } from "../pages/tools/ToolsPage";
import { PairingManager } from "../features/auth/PairingManager";
import type { MutableTravelGuideDataSource } from "../data/contracts";
import {
  createTripMutationController,
  type MutationTransport
} from "../services/mutations/controller";
import {
  SyncProvider,
  type SyncRuntime
} from "../services/sync/SyncProvider";

export function TripRoutePage({
  dataSource,
  mutationTransport,
  syncRuntime,
  tripId,
  activeTab
}: {
  dataSource: TravelGuideDataSource;
  mutationTransport?: MutationTransport;
  syncRuntime?: SyncRuntime;
  tripId: string;
  activeTab: TripTab;
}) {
  const workspace = useTripWorkspace(dataSource, tripId);
  const mutableDataSource = isMutableDataSource(dataSource) ? dataSource : null;
  const mutationController = useMemo(
    () => mutableDataSource && mutationTransport
      ? createTripMutationController({
        tripId,
        transport: mutationTransport,
        dataSource: mutableDataSource,
        reload: workspace.reload
      })
      : undefined,
    [mutableDataSource, mutationTransport, tripId, workspace.reload]
  );
  const { intentTripId, clearFocusRestoration } = useTripSwitcherFocus();

  useEffect(() => {
    if (!intentTripId || workspace.status === "loading") return;
    if (intentTripId !== tripId || workspace.status === "empty" || workspace.status === "error") {
      clearFocusRestoration();
    }
  }, [clearFocusRestoration, intentTripId, tripId, workspace.status]);

  let page: ReactNode;
  if (workspace.status === "loading") {
    page = <StatusPanel kind="loading" title="여행 정보를 불러오는 중" description="잠시만 기다려 주세요." />;
  } else if (workspace.status === "error") {
    page = <StatusPanel kind="error" title="여행 정보를 불러오지 못했습니다" description={workspace.message} action={{ label: "다시 시도", onClick: workspace.retry }} />;
  } else if (workspace.status === "empty") {
    page = <StatusPanel kind="not-found" title="여행을 찾을 수 없습니다" description="새 여행의 내부 데이터는 다음 단계에서 연결됩니다. 기존 여행이라면 여행 서재에서 다시 선택해 주세요." action={{ label: "여행 서재로 이동", onClick: navigateToLibrary }} />;
  } else {
    page = (
      <TripShell context={workspace.data.context} activeTab={activeTab}>
        {activeTab === "today" ? (
          <section aria-labelledby="trip-today-title">
            <h1 id="trip-today-title" className="today-route-title">오늘</h1>
            <TodayPage
              bookings={workspace.data.tools.bookings}
              checkItems={workspace.data.tools.checkItems}
              members={workspace.data.tools.members}
              mutationController={mutationController}
              today={workspace.data.today}
              trip={workspace.data.context.trip}
              viewerMemberId={workspace.data.context.viewer.memberId}
            />
          </section>
        ) : activeTab === "map" ? (
          <MapPage
            days={workspace.data.schedule.days}
            mutationController={mutationController}
            places={workspace.data.mapPreview.places}
            viewerMemberId={workspace.data.context.viewer.memberId}
          />
        ) : activeTab === "schedule" ? (
          <SchedulePage
            days={workspace.data.schedule.days}
            mutationController={mutationController}
            timeZone={workspace.data.context.trip.timeZone}
            tripId={tripId}
          />
        ) : (
          <ToolsPage
            deviceManagement={mutationTransport
              ? <PairingManager />
              : <p>읽기 전용 미리보기에서는 기기를 관리할 수 없습니다.</p>}
            mutationController={mutationController}
            reload={workspace.reload}
            tools={workspace.data.tools}
            workspace={workspace.data}
          />
        )}
      </TripShell>
    );
  }

  return syncRuntime && mutableDataSource ? (
    <SyncProvider
      dataSource={mutableDataSource}
      reload={workspace.reload}
      runtime={syncRuntime}
      tripId={tripId}
    >
      {page}
    </SyncProvider>
  ) : page;
}

function isMutableDataSource(
  dataSource: TravelGuideDataSource
): dataSource is MutableTravelGuideDataSource {
  return "invalidateTrip" in dataSource
    && typeof dataSource.invalidateTrip === "function";
}
