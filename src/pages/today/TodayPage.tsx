import { AppLink } from "../../components/AppLink";
import { Icon } from "../../components/Icon";
import type { ScheduleItemView, TodayViewModel, TripSummaryViewModel } from "../../data/contracts";
import { BookingCard, BudgetCard, MovementCard, WeatherCard } from "./TodayCards";
import { pathForTrip } from "../../app/router";

export function TodayPage({ trip, today }: { trip: TripSummaryViewModel; today: TodayViewModel }) {
  const schedule = [...today.schedule].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const firstIncompleteId = schedule.find((item) => !item.isDone)?.id;
  const heroTitle = today.phase === "upcoming"
    ? today.headline
    : today.phase === "active"
      ? `${trip.destination}의 오늘`
      : "여행을 다시 돌아봅니다";
  const heroEyebrow = today.phase === "active" ? "여행 중" : today.greeting;
  const scheduleHeading = today.phase === "upcoming"
    ? "첫날 일정 미리보기"
    : today.phase === "active"
      ? "오늘 일정"
      : "완료 일정 다시 보기";

  return (
    <div className="today-page">
      <section className={`today-hero today-hero--${today.phase}`} aria-labelledby="today-hero-title">
        <div>
          <p className="today-hero__eyebrow">{heroEyebrow}</p>
          <h2 id="today-hero-title">{heroTitle}</h2>
          {today.phase === "upcoming" ? <UpcomingHero trip={trip} today={today} /> : null}
          {today.phase === "active" ? <ActiveHero trip={trip} today={today} /> : null}
          {today.phase === "completed" ? <CompletedHero trip={trip} today={today} /> : null}
        </div>
        {today.phase === "completed" ? (
          <img className="today-hero__cover" src={trip.coverImageUrl} alt={`${trip.destination} 여행의 마지막 대표 장면`} />
        ) : null}
      </section>

      <div className="today-dashboard" aria-label="오늘 요약">
        <WeatherCard weather={today.weather} />
        <MovementCard nextMovement={today.nextMovement} />
        <BookingCard booking={today.booking} tripId={trip.id} />
        <BudgetCard budget={today.budget} />
      </div>

      <section className="today-schedule" aria-labelledby="today-schedule-title">
        <div className="today-section-heading">
          <div>
            <p className="today-section-heading__eyebrow">
              {today.phase === "upcoming" ? (
                <>첫날 · <time dateTime={today.localDate}>{today.dayLabel}</time></>
              ) : today.phase === "active" ? (
                <time dateTime={today.localDate}>{today.dayLabel}</time>
              ) : (
                <>
                  <time dateTime={trip.startDate}>{trip.startDate}</time>
                  {" — "}
                  <time dateTime={trip.endDate}>{trip.endDate}</time>
                </>
              )}
            </p>
            <h2 id="today-schedule-title">{scheduleHeading}</h2>
          </div>
          <AppLink href={pathForTrip(trip.id, "schedule")}>전체 일정</AppLink>
        </div>
        <ol className="today-schedule__list">
          {schedule.map((item) => <ScheduleItem key={item.id} item={item} isNext={item.id === firstIncompleteId} />)}
        </ol>
      </section>

      <section className="today-quick-tools" aria-labelledby="today-quick-tools-title">
        <h2 id="today-quick-tools-title">빠른 도구</h2>
        <div>
          <AppLink href={pathForTrip(trip.id, "map")}>지도 보기</AppLink>
          <AppLink href={`${pathForTrip(trip.id, "tools")}#bookings`}>예약·바우처</AppLink>
          <AppLink href={`${pathForTrip(trip.id, "tools")}#emergency`}>비상 연락처</AppLink>
        </div>
      </section>
    </div>
  );
}

function UpcomingHero({ trip, today }: { trip: TripSummaryViewModel; today: TodayViewModel }) {
  const firstItem = today.schedule.slice().sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
  return (
    <>
      <p className="today-hero__summary">{today.dDay === null
        ? "출발일 정보를 아직 받지 못했습니다."
        : `D-${today.dDay} · 첫날의 이동과 예약을 미리 확인하세요.`}</p>
      {firstItem ? <p className="today-hero__detail">첫 일정 <time>{timeOf(firstItem)}</time> · {firstItem.title}</p> : null}
      <p className="today-hero__detail">{today.booking
        ? `예약 상태: ${today.booking.status === "confirmed" ? "확정" : "확인 필요"}`
        : "예약 정보를 아직 받지 못했습니다."}</p>
      <AppLink className="primary-button" href={pathForTrip(trip.id, "schedule")}>첫날 일정 보기</AppLink>
    </>
  );
}

function ActiveHero({ trip, today }: { trip: TripSummaryViewModel; today: TodayViewModel }) {
  return (
    <>
      <p className="today-hero__summary">{today.dayLabel} · {trip.destination}</p>
      {today.nextMovement ? <p className="today-hero__detail">다음 출발 <time>{today.nextMovement.departureTime}</time> · {today.nextMovement.countdownLabel}</p> : null}
      <AppLink className="primary-button" href={pathForTrip(trip.id, "schedule")}>전체 일정 보기</AppLink>
    </>
  );
}

function CompletedHero({ trip, today }: { trip: TripSummaryViewModel; today: TodayViewModel }) {
  return (
    <>
      <p className="today-hero__summary">{trip.startDate} — {trip.endDate}</p>
      <p className="today-hero__detail">{today.summary
        ? `방문 장소 ${today.summary.visitedPlaceCount}곳 · 완료 일정 ${today.summary.completedItemCount}개`
        : "여행 요약 정보를 아직 받지 못했습니다."}</p>
      <AppLink className="primary-button" href={pathForTrip(trip.id, "schedule")}>일정 다시 보기</AppLink>
    </>
  );
}

function ScheduleItem({ item, isNext }: { item: ScheduleItemView; isNext: boolean }) {
  return (
    <li
      className={`today-schedule__item${item.isDone ? " is-done" : ""}${isNext ? " is-next" : ""}`}
      aria-label={`일정: ${item.title}, ${item.isDone ? "완료" : "예정"}${isNext ? ", 다음 일정" : ""}`}
    >
      <time className="today-schedule__time">{timeOf(item)}</time>
      <div className="today-schedule__content">
        {isNext ? <p className="today-schedule__next"><Icon name="today" />다음 일정</p> : null}
        <p className="today-schedule__title">{item.title}</p>
        <p>{item.place} · {item.description}</p>
        <p className="today-schedule__meta">
          <span>{kindLabel(item.kind)}</span>
          <span className="today-schedule__status">{item.isDone ? "완료" : "예정"}</span>
        </p>
      </div>
    </li>
  );
}

function timeOf(item: ScheduleItemView): string {
  return item.startsAt.slice(11, 16);
}

function kindLabel(kind: ScheduleItemView["kind"]): string {
  return { movement: "이동", meal: "식사", attraction: "관광", booking: "예약", note: "메모" }[kind];
}
