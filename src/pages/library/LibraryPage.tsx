import { useState } from "react";
import { pathForTrip } from "../../app/router";
import { AppLink } from "../../components/AppLink";
import { StatusPanel } from "../../components/StatusPanel";
import type { TravelGuideDataSource, TripPhase, TripSummaryViewModel } from "../../data/contracts";
import { useTravelLibrary } from "../../data/useTravelData";

type LibraryFilter = "all" | TripPhase;

const filters: Array<{ value: LibraryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "upcoming", label: "예정" },
  { value: "active", label: "여행 중" },
  { value: "completed", label: "완료" }
];

const phaseLabels: Record<TripPhase, string> = {
  upcoming: "예정",
  active: "여행 중",
  completed: "완료"
};

function formatDateRange(startDate: string, endDate: string): string {
  const formatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
  return `${formatter.format(new Date(`${startDate}T12:00:00`))} ~ ${formatter.format(
    new Date(`${endDate}T12:00:00`)
  )}`;
}

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "최근 수정 정보 없음";
  return `${new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date)} 수정`;
}

function LibrarySkeleton() {
  return (
    <section className="library-grid" aria-busy="true" aria-label="여행을 불러오는 중">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="library-card library-card--skeleton">
          <div className="library-card__cover" />
          <div className="library-card__body">
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </section>
  );
}

function TripCard({ trip }: { trip: TripSummaryViewModel }) {
  return (
    <article className="library-card">
      <AppLink className="library-card__link" href={pathForTrip(trip.id, "today")}>
        <img className="library-card__cover" src={trip.coverImageUrl} alt="" />
        <div className="library-card__body">
          <p className="library-card__destination">{trip.country} · {trip.destination}</p>
          <h2>{trip.title}</h2>
          <p className="library-card__dates"><time>{formatDateRange(trip.startDate, trip.endDate)}</time></p>
          <dl className="library-card__details">
            <div><dt>여행자</dt><dd>{trip.travelerCount}명</dd></div>
            <div><dt>상태</dt><dd><span className={`chip chip--${trip.phase}`}>{phaseLabels[trip.phase]}</span></dd></div>
            <div><dt>예약</dt><dd>{trip.bookingCount}건</dd></div>
          </dl>
          <p className="library-card__updated"><time>{formatUpdatedAt(trip.updatedAt)}</time></p>
        </div>
      </AppLink>
    </article>
  );
}

export function LibraryPage({ dataSource }: { dataSource: TravelGuideDataSource }) {
  const library = useTravelLibrary(dataSource);
  const [filter, setFilter] = useState<LibraryFilter>("all");

  if (library.status === "loading") return <LibrarySkeleton />;

  if (library.status === "empty") {
    return (
      <section className="library-page">
        <StatusPanel
          kind="empty"
          title="저장된 여행이 없습니다"
          description="여행 목록을 다시 불러오거나 실제 여행 만들기 연결을 기다려 주세요."
          action={{ label: "다시 불러오기", onClick: library.retry }}
        />
        <CreateTripNotice />
      </section>
    );
  }

  if (library.status === "error") {
    return (
      <section className="library-page">
        <StatusPanel
          kind="error"
          title="여행을 불러오지 못했습니다"
          description={library.message}
          action={{ label: "다시 시도", onClick: library.retry }}
        />
      </section>
    );
  }

  const visibleTrips = library.data.filter((trip) => filter === "all" || trip.phase === filter);
  const firstTrip = library.data[0];

  return (
    <section className="library-page" aria-labelledby="library-title">
      <div className="library-page__heading">
        <div>
          <p className="library-page__eyebrow">OUR TRIPS</p>
          <h1 id="library-title">여행 서재</h1>
          <p>둘이 함께 만든 여행을 필요한 순간에 바로 꺼내 보세요.</p>
        </div>
        <div className="library-page__actions">
          {firstTrip ? (
            <AppLink className="secondary-button" href={`${pathForTrip(firstTrip.id, "tools")}#devices`}>
              연결 기기
            </AppLink>
          ) : null}
          <CreateTripNotice />
        </div>
      </div>

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

      {visibleTrips.length ? (
        <div className="library-grid">
          {visibleTrips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
        </div>
      ) : (
        <StatusPanel
          kind="empty"
          title="이 상태의 여행이 없습니다"
          description="다른 상태를 선택해 보세요."
        />
      )}
    </section>
  );
}

function CreateTripNotice() {
  return (
    <div className="create-trip-notice">
      <button className="primary-button" type="button" disabled>새 여행 만들기</button>
      <p>실제 여행 만들기는 Task 5에서 연결됩니다</p>
    </div>
  );
}
