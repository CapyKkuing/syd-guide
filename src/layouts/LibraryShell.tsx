import type { ReactNode } from "react";
import { AppLink } from "../components/AppLink";
import { InstallPrompt } from "../components/InstallPrompt";
import { ThemeControl } from "../app/theme/ThemeControl";
import { pathForLibrary } from "../app/router";

export function LibraryShell({ children }: { children: ReactNode }) {
  return (
    <div className="library-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <header className="library-header">
        <AppLink className="library-brand" href={pathForLibrary()} aria-label="둘만의 여행 가이드북, 여행 서재">
          <strong>둘만의 여행 가이드북</strong>
        </AppLink>
        <div className="library-header__actions">
          <ThemeControl />
          <InstallPrompt />
        </div>
      </header>
      <main id="main-content" className="library-content">
        {children}
      </main>
    </div>
  );
}
