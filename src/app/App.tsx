import { PairDevicePage } from "../features/auth/PairDevicePage";
import { StatusPanel } from "../components/StatusPanel";
import type { TravelGuideDataSource } from "../data/contracts";
import { fixtureTravelGuideDataSource } from "../data/fixture/fixtureDataSource";
import { LibraryShell } from "../layouts/LibraryShell";
import { LibraryPage } from "../pages/library/LibraryPage";
import { navigateToLibrary, useRoute } from "./router";
import { ThemeProvider } from "./theme/ThemeProvider";
import { TripRoutePage } from "./TripRoutePage";
import { TripSwitcherFocusProvider } from "./TripSwitcherFocus";
import { useEffect } from "react";

interface AppProps {
  pairToken?: string | null;
  dataSource?: TravelGuideDataSource;
}

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
  dataSource = fixtureTravelGuideDataSource
}: AppProps) {
  const route = useRoute();

  if (route.name === "root") return <RootRedirect />;
  if (route.name === "pair") return <PairDevicePage token={pairToken} />;
  if (route.name === "library") {
    return (
      <LibraryShell>
        <LibraryPage dataSource={dataSource} />
      </LibraryShell>
    );
  }
  if (route.name === "trip") {
    return <TripRoutePage dataSource={dataSource} tripId={route.tripId} activeTab={route.tab} />;
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
