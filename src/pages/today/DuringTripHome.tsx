import { useCallback, useEffect, useState } from "react";
import { pathForTrip } from "../../app/router";
import { AppLink } from "../../components/AppLink";
import { BottomSheet } from "../../components/BottomSheet";
import { ExpensePanel } from "./ExpensePanel";
import {
  expenseReminderKey,
  selectNextSchedule,
  shouldShowExpenseReminder,
} from "./homeSelectors";
import { MovementCard, WeatherCard } from "./TodayCards";
import type { TodayHomeProps } from "./todayHomeTypes";

export function DuringTripHome({
  members,
  mutationController,
  today,
  trip,
  viewerMemberId,
}: TodayHomeProps) {
  const [reminderOpen, setReminderOpen] = useState(() =>
    shouldOpenReminder(trip.id, today.localDate, today.experiencePhase, trip.timeZone)
  );
  const [expenseOpenSignal, setExpenseOpenSignal] = useState(0);
  const schedule = selectNextSchedule(today.schedule, new Date());

  const checkReminder = useCallback(() => {
    const dismissed = window.localStorage.getItem(
      expenseReminderKey(trip.id, today.localDate),
    ) === "dismissed";
    if (shouldShowExpenseReminder({
      experiencePhase: today.experiencePhase,
      localHour: hourInZone(new Date(), trip.timeZone),
      dismissed,
    })) {
      setReminderOpen(true);
    }
  }, [today.experiencePhase, today.localDate, trip.id, trip.timeZone]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkReminder();
    };
    window.addEventListener("focus", checkReminder);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", checkReminder);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkReminder]);

  function dismissReminder(openExpense: boolean) {
    window.localStorage.setItem(
      expenseReminderKey(trip.id, today.localDate),
      "dismissed",
    );
    setReminderOpen(false);
    if (openExpense) setExpenseOpenSignal((value) => value + 1);
  }

  return (
    <div className="today-page today-home today-home--during">
      <section className="today-hero today-hero--active" aria-labelledby="today-hero-title">
        <div className="today-hero__copy">
          <p className="today-hero__eyebrow">여행 중 · {today.dayLabel}</p>
          <h2 id="today-hero-title">{trip.destination}의 오늘</h2>
          <p className="today-hero__summary">{today.nextMovement
            ? `${today.nextMovement.departureTime} 다음 이동 · ${today.nextMovement.countdownLabel}`
            : "다음 이동을 일정에서 확인하세요."}</p>
          <AppLink className="primary-button today-hero__action" href={pathForTrip(trip.id, "schedule")}>전체 일정</AppLink>
        </div>
        <figure className="today-hero__visual">
          <img className="today-hero__cover" src={trip.coverImageUrl} alt={`${trip.destination} 여행 대표 사진`} />
          <figcaption>{today.localDate}</figcaption>
        </figure>
      </section>

      <section
        className="today-action-section"
        data-section="schedule"
        aria-labelledby="next-schedule-title"
      >
        <div className="expense-panel__heading">
          <div>
            <p className="today-section-heading__eyebrow">NEXT 3</p>
            <h2 id="next-schedule-title">다음 일정</h2>
          </div>
          <AppLink href={pathForTrip(trip.id, "schedule")}>전체 보기</AppLink>
        </div>
        {schedule.length ? (
          <ol className="today-schedule__list">
            {schedule.map((item) => (
              <li className="today-schedule__item" key={item.id}>
                <time className="today-schedule__time">{item.startsAt.slice(11, 16)}</time>
                <div><strong>{item.title}</strong><p>{item.place || item.description}</p></div>
              </li>
            ))}
          </ol>
        ) : <p className="today-empty-state">남은 일정이 없습니다.</p>}
      </section>

      <div className="today-dashboard" aria-label="오늘 여행 정보">
        <WeatherCard weather={today.weather} />
        <section
          className="today-card today-live-tools"
          data-section="map"
          aria-labelledby="today-map-title"
        >
          <h3 id="today-map-title">지도</h3>
          <p>오늘 일정과 저장한 장소의 위치를 지도에서 확인하세요.</p>
          <AppLink className="today-card__link" href={pathForTrip(trip.id, "map")}>
            지도 보기
          </AppLink>
        </section>
        <section
          className="today-card today-live-tools"
          data-section="nearby"
          aria-labelledby="today-nearby-title"
        >
          <h3 id="today-nearby-title">주변 저장 장소</h3>
          <p>위치 권한이나 연결이 없으면 저장 장소 목록으로 확인합니다.</p>
          <AppLink className="today-card__link" href={pathForTrip(trip.id, "map")}>
            저장 장소 보기
          </AppLink>
        </section>
        <MovementCard nextMovement={today.nextMovement} />
      </div>

      <ExpensePanel
        controller={mutationController}
        expenses={today.expenses}
        initiallyOpen={expenseOpenSignal > 0}
        key={expenseOpenSignal}
        localDate={today.localDate}
        members={members}
        mode="during"
        viewerMemberId={viewerMemberId}
      />

      {reminderOpen ? (
        <BottomSheet ariaLabel="오늘 지출 정리 알림" onClose={() => dismissReminder(false)} returnFocusTo={null}>
          <div className="expense-reminder">
            <p className="today-section-heading__eyebrow">21:00 CHECK</p>
            <h2>오늘 쓴 돈, 잊기 전에 정리할까요?</h2>
            <p>식비·교통·쇼핑 등 오늘 지출을 지금 기록해 두세요.</p>
            <div className="tool-editor__actions">
              <button onClick={() => dismissReminder(false)} type="button">오늘은 닫기</button>
              <button className="primary-button" onClick={() => dismissReminder(true)} type="button">지출 기록</button>
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

function hourInZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour ?? 0);
}

function shouldOpenReminder(
  tripId: string,
  localDate: string,
  experiencePhase: TodayHomeProps["today"]["experiencePhase"],
  timeZone: string,
): boolean {
  const dismissed = window.localStorage.getItem(
    expenseReminderKey(tripId, localDate),
  ) === "dismissed";
  return shouldShowExpenseReminder({
    experiencePhase,
    localHour: hourInZone(new Date(), timeZone),
    dismissed,
  });
}
