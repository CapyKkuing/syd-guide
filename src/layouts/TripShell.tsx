import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@astryxdesign/core";
import { ThemeControl } from "../app/theme/ThemeControl";
import { pathForLibrary, pathForTrip, type TripTab } from "../app/router";
import { useTripSwitcherFocus } from "../app/TripSwitcherFocus";
import { AppLink } from "../components/AppLink";
import { Icon, type IconName } from "../components/Icon";
import type { TripContextViewModel } from "../data/contracts";

const tripNavItems: Array<{ tab: TripTab; label: string; icon: IconName }> = [
  { tab: "today", label: "오늘", icon: "today" },
  { tab: "schedule", label: "일정", icon: "schedule" },
  { tab: "map", label: "지도", icon: "map" },
  { tab: "tools", label: "도구", icon: "tools" }
];

function initials(name: string): string {
  return Array.from(name).slice(0, 2).join("");
}

function dayNumber(context: TripContextViewModel): string {
  const start = Date.parse(`${context.trip.startDate}T00:00:00.000Z`);
  const displayDate = context.trip.phase === "completed"
    ? context.trip.endDate
    : context.localDate;
  const displayTime = Date.parse(`${displayDate}T00:00:00.000Z`);
  return String(Math.max(1, Math.floor((displayTime - start) / 86_400_000) + 1)).padStart(2, "0");
}

function partnerStatusCopy(partnerStatus: TripContextViewModel["partnerStatus"]) {
  return partnerStatus === "connected"
    ? { desktop: "참여자 등록됨", mobile: "등록됨" }
    : { desktop: "참여자 등록 필요", mobile: "등록 필요" };
}

export function TripShell({
  context,
  activeTab,
  children
}: {
  context: TripContextViewModel;
  activeTab: TripTab;
  children: ReactNode;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const { intentTripId, requestFocusRestoration, clearFocusRestoration } = useTripSwitcherFocus();
  const partnerCopy = partnerStatusCopy(context.partnerStatus);

  const closeSwitcher = (restoreFocus = true) => {
    setSwitcherOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!switcherOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSwitcher();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!switcherRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        closeSwitcher();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [switcherOpen]);

  useEffect(() => {
    if (intentTripId !== context.trip.id) return;
    triggerRef.current?.focus();
    clearFocusRestoration();
  }, [clearFocusRestoration, context.trip.id, intentTripId]);

  useEffect(() => {
    const scrollContainer = document.getElementById("trip-scroll");
    const updateVisibility = () => setShowBackToTop(window.scrollY > 240 || (scrollContainer?.scrollTop ?? 0) > 240);

    window.addEventListener("scroll", updateVisibility, { passive: true });
    scrollContainer?.addEventListener("scroll", updateVisibility, { passive: true });
    updateVisibility();
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      scrollContainer?.removeEventListener("scroll", updateVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("trip-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="trip-shell">
      <a className="skip-link" href="#trip-content">본문으로 건너뛰기</a>
      <div id="trip-scroll" className="trip-scroll">
        <header className="trip-header">
        <AppLink className="trip-header__back" href={pathForLibrary()} aria-label="여행 서재로 돌아가기">
          <Icon name="library" />
          <span>여행 서재</span>
        </AppLink>
        <div className="trip-header__context">
          <button
            ref={triggerRef}
            aria-controls="trip-switcher-menu"
            aria-expanded={switcherOpen}
            aria-label="여행 전환"
            className="trip-switcher-trigger"
            onClick={() => setSwitcherOpen((open) => !open)}
            type="button"
          >
            <span>{context.trip.destination.toUpperCase()} · DAY {dayNumber(context)}</span>
            <Icon name="chevron" />
          </button>
          <p>{context.dayLabel}</p>
          {switcherOpen ? (
            <div ref={switcherRef} id="trip-switcher-menu" className="trip-switcher-menu" aria-label="여행 목록">
              {context.trips.map((trip) => (
                <AppLink
                  key={trip.id}
                  aria-label={trip.title}
                  className="trip-switcher-menu__item"
                  href={pathForTrip(trip.id, "today")}
                  onNavigate={() => {
                    setSwitcherOpen(false);
                    requestFocusRestoration(trip.id);
                  }}
                >
                  <span>{trip.title}</span>
                  <small>{trip.destination}</small>
                </AppLink>
              ))}
            </div>
          ) : null}
        </div>
        <div className="trip-header__actions">
          <span className="trip-avatar" aria-label={`${context.viewer.displayName} ${context.viewer.role === "owner" ? "관리자" : "참여자"}`}>
            {initials(context.viewer.displayName)}
          </span>
          <span
            aria-label={partnerCopy.desktop}
            className={`partner-status partner-status--${context.partnerStatus}`}
            role="status"
          >
            <span aria-hidden="true" className="partner-status__desktop">{partnerCopy.desktop}</span>
            <span aria-hidden="true" className="partner-status__mobile">{partnerCopy.mobile}</span>
          </span>
          <ThemeControl />
        </div>
        </header>
        <main id="trip-content" className="trip-content">{children}</main>
      </div>
      {showBackToTop ? (
        <Button
          className="trip-back-to-top"
          icon={<Icon className="trip-back-to-top__icon" name="chevron" />}
          label="맨 위로"
          onClick={scrollToTop}
          size="sm"
          variant="secondary"
        />
      ) : null}
      <nav className="trip-navigation" aria-label="여행 메뉴">
        {tripNavItems.map((item) => (
          <AppLink
            key={item.tab}
            className={`trip-navigation__item${item.tab === activeTab ? " is-active" : ""}`}
            href={pathForTrip(context.trip.id, item.tab)}
            aria-current={item.tab === activeTab ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </AppLink>
        ))}
      </nav>
    </div>
  );
}
