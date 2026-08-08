import { PairDevicePage } from "../features/auth/PairDevicePage";
import { PairingManager } from "../features/auth/PairingManager";
import { ParticipantSetupGate } from "../features/auth/ParticipantSetup";
import {
  apiTripLibraryClient,
  createFixturePreviewTripLibraryClient,
  type TripLibraryClient
} from "../features/trips/api";
import { StatusPanel } from "../components/StatusPanel";
import type { TravelGuideDataSource } from "../data/contracts";
import { fixtureTravelGuideDataSource } from "../data/fixture/fixtureDataSource";
import { SnapshotTravelGuideDataSource } from "../data/api/snapshotDataSource";
import { getPrincipal } from "../features/auth/api";
import { LibraryShell } from "../layouts/LibraryShell";
import { LibraryPage } from "../pages/library/LibraryPage";
import {
  navigate,
  navigateToLibrary,
  pathForPair,
  useRoute
} from "./router";
import { resolveRootStartPath } from "./rootStart";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AstryxThemeBridge } from "./theme/AstryxThemeBridge";
import { TripRoutePage } from "./TripRoutePage";
import { TripSwitcherFocusProvider } from "./TripSwitcherFocus";
import { useEffect, useMemo } from "react";
import { apiClient } from "../services/api/client";
import { openTravelDatabase, type TravelDatabase } from "../services/offline/database";
import { mediaApiClient } from "../services/media/api";
import { GoogleDriveProvider } from "../services/media/googleDriveProvider";
import { MediaThumbnailStore } from "../services/offline/mediaThumbnailStore";

interface AppProps {
  pairToken?: string | null;
  dataSource?: TravelGuideDataSource;
  tripLibraryClient?: TripLibraryClient;
}

let databasePromise: Promise<TravelDatabase> | null = null;
const database = () => {
  databasePromise ??= openTravelDatabase();
  return databasePromise;
};
const mediaThumbnailStore = new MediaThumbnailStore(database);
const googleDriveProvider = new GoogleDriveProvider();
const snapshotTravelGuideDataSource = new SnapshotTravelGuideDataSource(
  apiClient,
  getPrincipal,
  () => new Date(),
  { onSessionInvalid: () => navigate(pathForPair(), true) }
);

function RootRedirect() {
  useEffect(() => {
    let active = true;
    void resolveRootStartPath().then((path) => {
      if (active) navigate(path, true);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <StatusPanel
      kind="loading"
      title="여행 서재로 이동 중"
      description="잠시만 기다려 주세요."
    />
  );
}

export function App(props: AppProps) {
  return (
    <ThemeProvider>
      <AstryxThemeBridge>
        <TripSwitcherFocusProvider>
          <AppContent {...props} />
        </TripSwitcherFocusProvider>
      </AstryxThemeBridge>
    </ThemeProvider>
  );
}

function AppContent({
  pairToken = null,
  dataSource: suppliedDataSource,
  tripLibraryClient
}: AppProps) {
  const isFixturePreview =
    suppliedDataSource !== undefined || import.meta.env.MODE === "github-pages";
  const dataSource = suppliedDataSource ?? (
    isFixturePreview
      ? fixtureTravelGuideDataSource
      : snapshotTravelGuideDataSource
  );
  const libraryClient = useMemo(() => {
    if (tripLibraryClient) return tripLibraryClient;
    if (suppliedDataSource || import.meta.env.MODE === "github-pages") {
      return createFixturePreviewTripLibraryClient(dataSource);
    }
    return apiTripLibraryClient;
  }, [dataSource, suppliedDataSource, tripLibraryClient]);
  const route = useRoute();

  if (route.name === "root") return <RootRedirect />;
  if (route.name === "pair") return <PairDevicePage token={pairToken} />;
  if (route.name === "library") {
    return (
      <LibraryShell>
        <ParticipantSetupGate enabled={!isFixturePreview && !tripLibraryClient}>
          <LibraryPage
            client={libraryClient}
            deviceManagement={<PairingManager />}
            initialEditTripId={new URLSearchParams(window.location.search).get("edit")}
            initialEditFocus={new URLSearchParams(window.location.search).get("focus") === "flights" ? "flights" : undefined}
          />
        </ParticipantSetupGate>
      </LibraryShell>
    );
  }
  if (route.name === "trip" || route.name === "memories") {
    return (
      <TripRoutePage
        dataSource={dataSource}
        mutationTransport={isFixturePreview ? undefined : apiClient}
        tripId={route.tripId}
        activeTab={route.name === "trip" ? route.tab : "today"}
        toolId={route.name === "trip" ? route.toolId : undefined}
        memoryView={route.name === "memories" ? route.view : undefined}
        mediaApi={isFixturePreview ? undefined : mediaApiClient}
        mediaProvider={isFixturePreview ? undefined : googleDriveProvider}
        mediaThumbnailStore={isFixturePreview ? undefined : mediaThumbnailStore}
      />
    );
  }

  return (
    <StatusPanel
      kind="not-found"
      title="화면을 찾을 수 없습니다"
      description="주소를 확인하거나 여행 서재로 돌아가세요."
      action={{ label: "여행 서재로 이동", onClick: navigateToLibrary }}
    />
  );
}
