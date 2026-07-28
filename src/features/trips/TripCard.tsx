import { useEffect, useRef, useState } from "react";
import { pathForTrip } from "../../app/router";
import { AppLink } from "../../components/AppLink";
import type { TripLibrarySummary } from "./api";

const statusLabels = {
  upcoming: "예정",
  active: "여행 중",
  completed: "완료"
} as const;

function formatDateRange(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  });
  return `${formatter.format(new Date(`${startDate}T12:00:00`))} ~ ${formatter.format(
    new Date(`${endDate}T12:00:00`)
  )}`;
}

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "최근 수정 정보 없음";
  return `${new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  }).format(date)} 수정`;
}

export function TripCard({
  trip,
  readOnlyReason,
  onEdit,
  onTrash
}: {
  trip: TripLibrarySummary;
  readOnlyReason?: string;
  // ESLint's base rule does not recognize TypeScript function arguments.
  // eslint-disable-next-line no-unused-vars
  onEdit: (trip: TripLibrarySummary, opener: HTMLElement) => void;
  // eslint-disable-next-line no-unused-vars
  onTrash: (trip: TripLibrarySummary, opener: HTMLElement) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        setMenuOpen(false);
        queueMicrotask(() => triggerRef.current?.focus());
        return;
      }
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, [menuOpen]);

  return (
    <article className="library-card">
      <AppLink
        className="library-card__link"
        href={pathForTrip(trip.id, "today")}
      >
        {trip.coverImageUrl ? (
          <img className="library-card__cover" src={trip.coverImageUrl} alt="" />
        ) : (
          <div className="library-card__cover library-card__cover--fallback" aria-hidden="true">
            {trip.destination.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="library-card__body">
          <p className="library-card__destination">
            {trip.country ? `${trip.country} · ${trip.destination}` : trip.destination}
          </p>
          <h3>{trip.title}</h3>
          <p className="library-card__dates">
            <time>{formatDateRange(trip.startDate, trip.endDate)}</time>
          </p>
          <dl className="library-card__details">
            <div><dt>여행자</dt><dd>{trip.travelerCount}명</dd></div>
            <div>
              <dt>상태</dt>
              <dd>
                <span className={`chip chip--${trip.status}`}>
                  {statusLabels[trip.status]}
                </span>
              </dd>
            </div>
            <div><dt>일정</dt><dd>{trip.scheduleItemCount}건</dd></div>
            <div><dt>예약</dt><dd>{trip.bookingCount}건</dd></div>
          </dl>
          <p className="library-card__updated">
            <time>{formatUpdatedAt(trip.updatedAt)}</time>
          </p>
        </div>
      </AppLink>
      <div ref={menuRef} className="library-card__menu">
        <button
          ref={triggerRef}
          type="button"
          className="library-card__menu-trigger"
          aria-expanded={menuOpen}
          aria-label={`${trip.title} 메뉴`}
          disabled={Boolean(readOnlyReason)}
          title={readOnlyReason}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">•••</span>
        </button>
        {menuOpen ? (
          <div
            className="library-card__menu-popover"
            role="menu"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setMenuOpen(false);
              }
            }}
            onKeyDown={(event) => {
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')
              );
              const currentIndex = items.indexOf(document.activeElement as HTMLElement);
              let nextIndex: number | null = null;
              if (event.key === "ArrowDown") {
                nextIndex = (currentIndex + 1) % items.length;
              } else if (event.key === "ArrowUp") {
                nextIndex = (currentIndex - 1 + items.length) % items.length;
              } else if (event.key === "Home") {
                nextIndex = 0;
              } else if (event.key === "End") {
                nextIndex = items.length - 1;
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setMenuOpen(false);
                queueMicrotask(() => triggerRef.current?.focus());
              }
              const nextItem = nextIndex === null ? undefined : items[nextIndex];
              if (nextItem) {
                event.preventDefault();
                nextItem.focus();
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              aria-label={`${trip.title} 수정`}
              onClick={(event) => {
                setMenuOpen(false);
                onEdit(trip, triggerRef.current ?? event.currentTarget);
              }}
            >
              <span className="visually-hidden">{trip.title} </span>수정
            </button>
            <button
              type="button"
              role="menuitem"
              aria-label={`${trip.title} 휴지통으로 이동`}
              className="library-card__danger-action"
              onClick={(event) => {
                setMenuOpen(false);
                onTrash(trip, triggerRef.current ?? event.currentTarget);
              }}
            >
              <span className="visually-hidden">{trip.title} </span>휴지통으로 이동
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
