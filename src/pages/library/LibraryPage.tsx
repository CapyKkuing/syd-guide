import { useState, type ReactNode } from "react";
import { StatusPanel } from "../../components/StatusPanel";
import {
  ApiRequestError,
  type TripLibraryClient
} from "../../features/trips/api";
import {
  LibraryDialogs,
  type LibraryDialogState
} from "../../features/trips/LibraryDialogs";
import { LibrarySkeleton } from "../../features/trips/LibrarySkeleton";
import { TripCard } from "../../features/trips/TripCard";
import { useTripLibrary } from "../../features/trips/useTripLibrary";
import type { TripStatus } from "../../shared/entities";

type LibraryFilter = "all" | TripStatus;

const filters: Array<{ value: LibraryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "upcoming", label: "예정" },
  { value: "active", label: "여행 중" },
  { value: "completed", label: "완료" }
];

const groups: Array<{ status: TripStatus; label: string; regionLabel: string }> = [
  { status: "active", label: "여행 중", regionLabel: "여행 중 여행" },
  { status: "upcoming", label: "예정", regionLabel: "예정 여행" },
  { status: "completed", label: "완료", regionLabel: "완료 여행" }
];

function sessionRecovery(error: ApiRequestError) {
  const partnerCodes = new Set([
    "SESSION_REQUIRED",
    "SESSION_EXPIRED",
    "SESSION_REVOKED"
  ]);
  if (partnerCodes.has(error.code)) {
    return {
      title: "기기 연결이 필요합니다",
      description: "관리자에게 새 연결 링크를 요청해 이 기기를 다시 연결해 주세요."
    };
  }
  if (error.code === "ACCESS_REQUIRED" || error.code === "ACCESS_INVALID") {
    return {
      title: "관리자 로그인이 필요합니다",
      description: "관리자 호스트에서 Cloudflare Access 로그인을 다시 진행해 주세요."
    };
  }
  return null;
}

export function LibraryPage({
  client,
  deviceManagement,
  initialEditTripId,
  now = () => new Date()
}: {
  client: TripLibraryClient;
  deviceManagement?: ReactNode;
  initialEditTripId?: string | null;
  now?: () => Date;
}) {
  const library = useTripLibrary(client);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [dialog, setDialog] = useState<LibraryDialogState>(null);
  const [initialEditClosed, setInitialEditClosed] = useState(false);
  const initialEditTrip = !initialEditClosed && initialEditTripId
    ? library.active.trips.find((item) => item.id === initialEditTripId)
    : undefined;
  const visibleDialog = dialog ?? (
    initialEditTrip && !library.readOnlyReason
      ? { kind: "edit" as const, trip: initialEditTrip, opener: null }
      : null
  );

  const closeDialog = () => {
    library.clearMutationError();
    setInitialEditClosed(true);
    setDialog(null);
  };

  if (library.active.status === "loading" && library.active.trips.length === 0) {
    return <LibrarySkeleton />;
  }

  if (library.active.status === "error") {
    const recovery = sessionRecovery(library.active.error);
    if (recovery) {
      return (
        <StatusPanel
          kind="session-expired"
          title={recovery.title}
          description={recovery.description}
          action={{ label: "다시 확인", onClick: library.retryActive }}
        />
      );
    }
    return (
      <StatusPanel
        kind="error"
        title="여행을 불러오지 못했습니다"
        description={library.active.error.message}
        action={{ label: "다시 시도", onClick: library.retryActive }}
      />
    );
  }

  const visibleTrips = library.active.trips.filter(
    (trip) => filter === "all" || trip.status === filter
  );
  const sortedGroups = groups.map((group) => ({
    ...group,
    trips: visibleTrips
      .filter((trip) => trip.status === group.status)
      .sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)
      )
  })).filter((group) => group.trips.length > 0);
  const hasUpcomingGroup = sortedGroups.some((group) => group.status === "upcoming");
  const createCard = (
    <button
      type="button"
      className="library-create-card"
      disabled={Boolean(library.readOnlyReason)}
      title={library.readOnlyReason}
      onClick={(event) =>
        setDialog({ kind: "create", opener: event.currentTarget })}
    >
      <strong>새 여행 만들기</strong>
      <span>날짜와 여행지를 추가하세요.</span>
    </button>
  );

  return (
    <section className="library-page" aria-labelledby="library-title">
      <div className="library-page__heading">
        <div>
          <p className="library-page__eyebrow">OUR TRIPS</p>
          <h1 id="library-title">여행 서재</h1>
          <p>함께 만든 여행을 필요한 순간에 바로 꺼내 보세요.</p>
        </div>
        <div className="library-page__actions">
          <button
            type="button"
            className="secondary-button"
            disabled={Boolean(library.readOnlyReason)}
            title={library.readOnlyReason}
            onClick={(event) =>
              !library.readOnlyReason
                ? setDialog({ kind: "devices", opener: event.currentTarget })
                : undefined}
          >
            연결 기기
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={Boolean(library.readOnlyReason)}
            title={library.readOnlyReason}
            onClick={(event) => {
              library.loadTrash();
              setDialog({ kind: "trash", opener: event.currentTarget });
            }}
          >
            휴지통
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={Boolean(library.readOnlyReason)}
            title={library.readOnlyReason}
            onClick={(event) => setDialog({ kind: "create", opener: event.currentTarget })}
          >
            새 여행 만들기
          </button>
        </div>
      </div>

      {library.readOnlyReason ? (
        <p className="library-preview-notice" role="note">{library.readOnlyReason}</p>
      ) : null}

      <div className="library-filters" role="group" aria-label="여행 상태 필터">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            className={filter === item.value ? "is-selected" : undefined}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {sortedGroups.length > 0 ? (
        <div className="library-groups">
          {sortedGroups.map((group) => (
            <section
              key={group.status}
              className="library-group"
              aria-label={group.regionLabel}
            >
              <div className="library-group__heading">
                <h2>{group.label}</h2>
                <span>{group.trips.length}개</span>
              </div>
              <div className="library-grid">
                {group.trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    readOnlyReason={library.readOnlyReason}
                    onEdit={(selected, opener) =>
                      setDialog({ kind: "edit", trip: selected, opener })}
                    onTrash={(selected, opener) =>
                      setDialog({ kind: "confirm-trash", trip: selected, opener })}
                  />
                ))}
                {group.status === "upcoming" ? (
                  createCard
                ) : null}
              </div>
            </section>
          ))}
          {!hasUpcomingGroup ? (
            <div className="library-grid library-grid--create">
              {createCard}
            </div>
          ) : null}
        </div>
      ) : library.active.trips.length === 0 ? (
        <div className="library-empty">
          <StatusPanel
            kind="empty"
            title="저장된 여행이 없습니다"
            description="첫 여행을 만들어 함께 계획을 시작하세요."
            action={{ label: "다시 불러오기", onClick: library.retryActive }}
          />
          {createCard}
        </div>
      ) : (
        <div className="library-empty">
          <StatusPanel
            kind="empty"
            title="이 상태의 여행이 없습니다"
            description="다른 상태를 선택해 보세요."
          />
          {createCard}
        </div>
      )}

      <LibraryDialogs
        dialog={visibleDialog}
        library={library}
        deviceManagement={deviceManagement}
        now={now()}
        onClose={closeDialog}
      />
    </section>
  );
}
