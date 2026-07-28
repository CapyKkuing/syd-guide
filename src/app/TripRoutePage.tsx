import type { TravelGuideDataSource } from "../data/contracts";
import { useTripWorkspace } from "../data/useTravelData";
import { TripShell } from "../layouts/TripShell";
import { StatusPanel } from "../components/StatusPanel";
import { navigateToLibrary, type TripTab } from "./router";
import { useTripSwitcherFocus } from "./TripSwitcherFocus";
import { useEffect } from "react";
import { TodayPage } from "../pages/today/TodayPage";
import { SchedulePage } from "../pages/schedule/SchedulePage";
import { MapPage } from "../pages/map/MapPage";
import { ToolsPage } from "../pages/tools/ToolsPage";
import { PairingManager } from "../features/auth/PairingManager";

export function TripRoutePage({
  dataSource,
  tripId,
  activeTab
}: {
  dataSource: TravelGuideDataSource;
  tripId: string;
  activeTab: TripTab;
}) {
  const workspace = useTripWorkspace(dataSource, tripId);
  const { intentTripId, clearFocusRestoration } = useTripSwitcherFocus();

  useEffect(() => {
    if (!intentTripId || workspace.status === "loading") return;
    if (intentTripId !== tripId || workspace.status === "empty" || workspace.status === "error") {
      clearFocusRestoration();
    }
  }, [clearFocusRestoration, intentTripId, tripId, workspace.status]);

  if (workspace.status === "loading") {
    return <StatusPanel kind="loading" title="여행 정보를 불러오는 중" description="잠시만 기다려 주세요." />;
  }
  if (workspace.status === "error") {
    return <StatusPanel kind="error" title="여행 정보를 불러오지 못했습니다" description={workspace.message} action={{ label: "다시 시도", onClick: workspace.retry }} />;
  }
  if (workspace.status === "empty") {
    return <StatusPanel kind="not-found" title="여행을 찾을 수 없습니다" description="여행 서재에서 다른 여행을 선택해 주세요." action={{ label: "여행 서재로 이동", onClick: navigateToLibrary }} />;
  }

  return (
    <TripShell context={workspace.data.context} activeTab={activeTab}>
      {activeTab === "today" ? (
        <section aria-labelledby="trip-today-title">
          <h1 id="trip-today-title" className="today-route-title">오늘</h1>
          <TodayPage trip={workspace.data.context.trip} today={workspace.data.today} />
        </section>
      ) : activeTab === "map" ? (
        <MapPage days={workspace.data.schedule.days} places={workspace.data.mapPreview.places} />
      ) : activeTab === "schedule" ? (
        <SchedulePage days={workspace.data.schedule.days} />
      ) : (
        <ToolsPage tools={workspace.data.tools} deviceManagement={<PairingManager />} />
      )}
    </TripShell>
  );
}
