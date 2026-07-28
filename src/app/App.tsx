import { PairDevicePage } from "../features/auth/PairDevicePage";
import { PairingManager } from "../features/auth/PairingManager";
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
import { navigateToLibrary, useRoute } from "./router";
import { ThemeProvider } from "./theme/ThemeProvider";
import { TripRoutePage } from "./TripRoutePage";
import { TripSwitcherFocusProvider } from "./TripSwitcherFocus";
import { useEffect, useMemo } from "react";
import { apiClient } from "../services/api/client";

interface AppProps {
  pairToken?: string | null;
  dataSource?: TravelGuideDataSource;
  tripLibraryClient?: TripLibraryClient;
}

const snapshotTravelGuideDataSource = new SnapshotTravelGuideDataSource(
  apiClient,
  getPrincipal
);

function RootRedirect() {
  useEffect(() => navigateToLibrary(), []);
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
      <TripSwitcherFocusProvider>
        <AppContent {...props} />
      </TripSwitcherFocusProvider>
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
        <LibraryPage
          client={libraryClient}
          deviceManagement={<PairingManager />}
        />
      </LibraryShell>
    );
  }
  if (route.name === "trip") {
    return (
      <TripRoutePage
        dataSource={dataSource}
        mutationTransport={isFixturePreview ? undefined : apiClient}
        tripId={route.tripId}
        activeTab={route.tab}
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
