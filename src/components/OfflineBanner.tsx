import { useEffect, useState } from "react";

export function OfflineBanner() {
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
