import { useEffect, useState } from "react";
import { useSyncStatus } from "../services/sync/SyncContext";

export function OfflineBanner() {
  const sync = useSyncStatus();
  if (sync) return <ConnectedOfflineBanner sync={sync} />;
  return <PreviewOfflineBanner />;
}

function ConnectedOfflineBanner({
  sync
}: {
  sync: NonNullable<ReturnType<typeof useSyncStatus>>;
}) {
  return (
    <div className="offline-banner">
      <div className="offline-banner__status" role="status">
        <strong>{sync.online ? "온라인" : "오프라인"}</strong>
        <span>대기 {sync.queued}건</span>
        <span>충돌 {sync.conflicts}건</span>
        <span>
          마지막 동기화 {sync.lastSync
            ? new Intl.DateTimeFormat("ko-KR", {
              hour: "2-digit",
              minute: "2-digit"
            }).format(new Date(sync.lastSync))
            : "없음"}
        </span>
      </div>
      <button
        className="secondary-button"
        disabled={!sync.online || sync.syncing}
        onClick={() => void sync.syncNow()}
        type="button"
      >
        {sync.syncing ? "동기화 중" : "지금 동기화"}
      </button>
    </div>
  );
}

function PreviewOfflineBanner() {
  const [offline, setOffline] = useState(() => !window.navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;
  return <p className="offline-banner" role="status">오프라인 — 저장된 샘플 정보를 표시합니다</p>;
}
