import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent>();
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const showIosHint = /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleInstall);
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(undefined);
  };

  if (installEvent) {
    return (
      <button className="install-button" type="button" onClick={install}>
        앱 설치
      </button>
    );
  }

  if (showIosHint) {
    return <p className="install-hint">공유 → 홈 화면에 추가</p>;
  }

  return null;
}
