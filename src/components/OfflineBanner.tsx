import { useEffect, useState } from "react";
import { useSyncStatus } from "../services/sync/SyncContext";

export function OfflineBanner() {
  const sync = useSyncStatus();
  if (sync) return <ConnectedStatus sync={sync} />;
  return <PreviewConnectionStatus />;
}

function ConnectedStatus({
  sync
}: {
  sync: NonNullable<ReturnType<typeof useSyncStatus>>;
}) {
  return (
    <div className="offline-banner">
      <div className="offline-banner__status" role="status">
        <strong>{sync.online ? "온라인 자동 동기화" : "인터넷 연결 필요"}</strong>
        <span>다른 기기 변경은 최대 5초 안에 반영됩니다.</span>
        <span>
          마지막 확인 {sync.lastSync
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
        {sync.syncing ? "확인 중" : "최신 내용 확인"}
      </button>
    </div>
  );
}

function PreviewConnectionStatus() {
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

  return (
    <p className="offline-banner" role="status">
      {offline
        ? "인터넷 연결이 필요합니다. 연결 전에는 조회와 편집을 사용할 수 없습니다."
        : "온라인 전용 — 서버에 바로 저장합니다."}
    </p>
  );
}
