import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { MutableTravelGuideDataSource } from "../../data/contracts";
import { StatusPanel } from "../../components/StatusPanel";
import { SyncContext } from "./SyncContext";

export function SyncProvider({
  children,
  dataSource,
  pollIntervalMs = 5_000,
  reload,
  tripId
}: {
  children: ReactNode;
  dataSource: Pick<MutableTravelGuideDataSource, "invalidateTrip">;
  pollIntervalMs?: number;
  reload: () => void;
  tripId: string;
}) {
  const [online, setOnline] = useState(() => window.navigator.onLine);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const refreshInProgress = useRef(false);

  const syncNow = useCallback(async () => {
    if (!window.navigator.onLine || refreshInProgress.current) return;
    refreshInProgress.current = true;
    setSyncing(true);
    try {
      dataSource.invalidateTrip(tripId);
      reload();
      setLastSync(new Date().toISOString());
    } finally {
      refreshInProgress.current = false;
      setSyncing(false);
    }
  }, [dataSource, reload, tripId]);

  useEffect(() => {
    const isReady = () =>
      window.navigator.onLine && document.visibilityState === "visible";
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    const syncWhenActive = () => {
      if (isReady()) void syncNow();
    };

    if (isReady()) void syncNow();
    const interval = window.setInterval(syncWhenActive, pollIntervalMs);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", syncWhenActive);
    document.addEventListener("visibilitychange", syncWhenActive);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", syncWhenActive);
      document.removeEventListener("visibilitychange", syncWhenActive);
    };
  }, [pollIntervalMs, syncNow]);

  const status = {
    online,
    lastSync,
    syncing,
    syncNow,
  };

  if (!online) {
    return (
      <SyncContext.Provider value={status}>
        <StatusPanel
          action={{
            label: "연결 다시 확인",
            onClick: () => {
              const connected = window.navigator.onLine;
              setOnline(connected);
              if (connected) void syncNow();
            },
          }}
          description="이 앱은 온라인 전용입니다. 연결 전에는 여행 조회와 편집을 사용할 수 없습니다."
          kind="error"
          title="인터넷 연결이 필요합니다"
        />
      </SyncContext.Provider>
    );
  }

  return (
    <SyncContext.Provider value={status}>
      {children}
    </SyncContext.Provider>
  );
}
