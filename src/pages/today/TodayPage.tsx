import { Button, Carousel } from "@astryxdesign/core";
import { useRef } from "react";
import { AppLink } from "../../components/AppLink";
import { Icon } from "../../components/Icon";
import type { ScheduleItemView, TodayViewModel, TripSummaryViewModel } from "../../data/contracts";
import { BookingCard, BudgetCard, MovementCard, WeatherCard } from "./TodayCards";
import { pathForTrip } from "../../app/router";
import { useTodayMotion } from "./useTodayMotion";

export function TodayPage({ trip, today }: { trip: TripSummaryViewModel; today: TodayViewModel }) {
  const pageRef = useRef<HTMLDivElement>(null);
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
  const heroImageAlt = today.phase === "completed"
    ? `${trip.destination} 여행의 마지막 대표 장면`
    : `${trip.destination} 여행 대표 장면`;
  const marqueeText = `${trip.destination} · ${today.dayLabel} · ${trip.startDate} — ${trip.endDate}`;

  useTodayMotion(pageRef);

  return (
    <div className="today-page" ref={pageRef}>
      <section
        className={`today-hero today-hero--${today.phase}`}
        aria-labelledby="today-hero-title"
        data-motion-hero
      >
        <div className="today-hero__copy">
          <p className="today-hero__eyebrow">{heroEyebrow}</p>
          <h2 id="today-hero-title">{heroTitle}</h2>
          {today.phase === "upcoming" ? <UpcomingHero trip={trip} today={today} /> : null}
          {today.phase === "active" ? <ActiveHero trip={trip} today={today} /> : null}
          {today.phase === "completed" ? <CompletedHero trip={trip} today={today} /> : null}
        </div>
        <figure className="today-hero__visual">
          <img className="today-hero__cover" src={trip.coverImageUrl} alt={heroImageAlt} />
          <figcaption>{trip.title}</figcaption>
        </figure>
        <div className="today-hero__marquee" aria-label={marqueeText}>
          <div aria-hidden="true">
            {[0, 1].map((group) => (
              <span key={group}>
                {marqueeText} · {marqueeText} ·
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="today-bento">
        <div className="today-dashboard" aria-label="오늘 요약">
          <WeatherCard weather={today.weather} />
          <MovementCard nextMovement={today.nextMovement} />
          <BookingCard booking={today.booking} tripId={trip.id} />
          <BudgetCard budget={today.budget} />
        </div>

        <section className="today-schedule" aria-labelledby="today-schedule-title">
          <div className="today-section-heading" data-motion-scrub>
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
            <Button
              as={AppLink}
              href={pathForTrip(trip.id, "schedule")}
              label="전체 일정"
              size="sm"
              variant="ghost"
            />
          </div>
          <ol className="today-schedule__list">
            {schedule.map((item) => (
              <ScheduleItem
                key={item.id}
                item={item}
                isNext={item.id === firstIncompleteId}
              />
            ))}
          </ol>
        </section>

        <section className="today-quick-tools" aria-labelledby="today-quick-tools-title">
          <h2 id="today-quick-tools-title" data-motion-scrub>빠른 도구</h2>
          <Carousel
            aria-label="빠른 도구"
            className="today-quick-tools__carousel"
            gap={2}
            hasButtons
            hasEdgeFade={false}
            hasSnap
          >
            <Button
              as={AppLink}
              className="today-quick-tool"
              href={pathForTrip(trip.id, "map")}
              label="지도 보기"
              variant="secondary"
            />
            <Button
              as={AppLink}
              className="today-quick-tool"
              href={`${pathForTrip(trip.id, "tools")}#bookings`}
              label="예약·바우처"
              variant="secondary"
            />
            <Button
              as={AppLink}
              className="today-quick-tool"
              href={`${pathForTrip(trip.id, "tools")}#emergency`}
              label="비상 연락처"
              variant="secondary"
            />
          </Carousel>
        </section>
      </div>
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
      <Button
        as={AppLink}
        className="today-hero__action"
        href={pathForTrip(trip.id, "schedule")}
        label="첫날 일정 보기"
        size="lg"
        variant="primary"
      />
    </>
  );
}

function ActiveHero({ trip, today }: { trip: TripSummaryViewModel; today: TodayViewModel }) {
  return (
    <>
      <p className="today-hero__summary">{today.dayLabel} · {trip.destination}</p>
      {today.nextMovement ? <p className="today-hero__detail">다음 출발 <time>{today.nextMovement.departureTime}</time> · {today.nextMovement.countdownLabel}</p> : null}
      <Button
        as={AppLink}
        className="today-hero__action"
        href={pathForTrip(trip.id, "schedule")}
        label="전체 일정 보기"
        size="lg"
        variant="primary"
      />
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
      <Button
        as={AppLink}
        className="today-hero__action"
        href={pathForTrip(trip.id, "schedule")}
        label="일정 다시 보기"
        size="lg"
        variant="primary"
      />
    </>
  );
}

function ScheduleItem({ item, isNext }: { item: ScheduleItemView; isNext: boolean }) {
  return (
    <li
      className={`today-schedule__item${item.isDone ? " is-done" : ""}${isNext ? " is-next" : ""}`}
      aria-label={`일정: ${item.title}, ${item.isDone ? "완료" : "예정"}${isNext ? ", 다음 일정" : ""}`}
      data-motion-stack
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
