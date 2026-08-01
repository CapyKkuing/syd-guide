import { pathForLibrary, pathForTool } from "../../app/router";
import { AppLink } from "../../components/AppLink";
import { ExpensePanel } from "./ExpensePanel";
import { selectUrgentGaps } from "./homeSelectors";
import type { TodayHomeProps } from "./todayHomeTypes";

export function BeforeTripHome({
  bookings,
  checkItems,
  members,
  mutationController,
  today,
  trip,
  viewerMemberId,
}: TodayHomeProps) {
  const gaps = selectUrgentGaps({
    hasOutboundFlight: trip.hasOutboundFlight,
    hasReturnFlight: trip.hasReturnFlight,
    bookings,
    checkItems,
  });

  return (
    <div className="today-page today-home today-home--before">
      <section className="today-hero today-hero--upcoming" aria-labelledby="today-hero-title">
        <div className="today-hero__copy">
          <p className="today-hero__eyebrow">여행 전</p>
          <h2 id="today-hero-title">{today.dDay === null ? "출발 준비" : `D-${today.dDay}`}</h2>
          <p className="today-hero__summary">{trip.title}</p>
          <p className="today-hero__detail">{trip.startDate} — {trip.endDate}</p>
          <AppLink className="primary-button today-hero__action" href={pathForLibrary()}>여행 정보 편집</AppLink>
        </div>
        <figure className="today-hero__visual">
          <img className="today-hero__cover" src={trip.coverImageUrl} alt={`${trip.destination} 여행 대표 사진`} />
          <figcaption>{trip.destination}</figcaption>
        </figure>
      </section>

      <section className="today-action-section" aria-labelledby="urgent-gaps-title">
        <div className="expense-panel__heading">
          <div>
            <p className="today-section-heading__eyebrow">PREPARATION</p>
            <h2 id="urgent-gaps-title">지금 확인할 준비</h2>
          </div>
          <AppLink className="secondary-button" href={pathForTool(trip.id, "checklist")}>전체 준비 보기</AppLink>
        </div>
        {gaps.length ? (
          <ol className="urgent-gap-list">
            {gaps.map((gap) => (
              <li key={gap.kind}>
                <div><strong>{gap.label}</strong><p>{gap.description}</p></div>
                <AppLink href={gap.target === "trip" ? pathForLibrary() : pathForTool(trip.id, gap.target)}>
                  확인
                </AppLink>
              </li>
            ))}
          </ol>
        ) : <p className="today-empty-state">필수 준비가 모두 확인됐습니다.</p>}
      </section>

      <ExpensePanel
        controller={mutationController}
        expenses={today.expenses}
        localDate={today.localDate}
        members={members}
        mode="before"
        viewerMemberId={viewerMemberId}
      />
    </div>
  );
}
