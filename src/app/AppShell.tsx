import type { ReactNode } from "react";
import { InstallPrompt } from "../components/InstallPrompt";
import type { Page } from "./router";

const navItems = [
  { page: "library", icon: "▦", label: "여행" },
  { page: "today", icon: "◉", label: "오늘" },
  { page: "schedule", icon: "≡", label: "일정" },
  { page: "places", icon: "⌖", label: "장소" },
  { page: "more", icon: "•••", label: "더보기" }
] as const;

export function AppShell({
  children,
  currentPage
}: {
  children: ReactNode;
  currentPage: Page;
}) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>

      <header className="app-header">
        <div className="brand">
          <span className="brand__seal" aria-hidden="true">TWO</span>
          <div>
            <p className="brand__kicker">TRAVEL MEMORY BOOK</p>
            <strong>둘만의 여행 가이드북</strong>
          </div>
        </div>
        <InstallPrompt />
      </header>

      <main id="main-content" className="app-main">
        {children}
      </main>

      <nav className="main-nav" aria-label="주요 메뉴">
        {navItems.map((item) => (
          <a
            key={item.page}
            href={`#/${item.page}`}
            className={`nav-item${currentPage === item.page ? " is-active" : ""}`}
            aria-current={currentPage === item.page ? "page" : undefined}
          >
            <span className="nav-item__icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
