import { useState } from "react";
import type { ScheduleDayView, ScheduleItemView } from "../../data/contracts";
import { ScheduleDetailSheet } from "./ScheduleDetailSheet";

const kindLabels: Record<ScheduleItemView["kind"], string> = {
  movement: "이동",
  meal: "식사",
  attraction: "관광",
  booking: "예약",
  note: "메모"
};

function timeOf(value: string): string {
  return value.slice(11, 16);
}

export function SchedulePage({ days }: { days: ScheduleDayView[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<ScheduleItemView | null>(null);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLElement | null>(null);
  const day = days[selectedIndex] ?? null;

  if (!day) {
    return <section className="schedule-page" aria-labelledby="schedule-title"><h1 id="schedule-title">일정</h1><p>표시할 일정이 없습니다.</p></section>;
  }

  const items = [...day.items].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const nextItemId = items.find((item) => !item.isDone)?.id;

  return (
    <section className="schedule-page" aria-labelledby="schedule-title">
      <h1 id="schedule-title">일정</h1>
      <div aria-label="날짜 선택" className="schedule-day-selector">
        {days.map((candidate, index) => (
          <button
            key={candidate.date}
            aria-pressed={index === selectedIndex}
            className={index === selectedIndex ? "is-selected" : undefined}
            onClick={() => setSelectedIndex(index)}
            type="button"
          >
            <span>{candidate.dayLabel}</span>
            <small>{candidate.date}</small>
          </button>
        ))}
      </div>

      <section className="schedule-summary" aria-labelledby="schedule-day-title">
        <p>{day.dayLabel} · {day.date}</p>
        <h2 id="schedule-day-title">{day.headline}</h2>
        <p>{items.length}개 일정</p>
      </section>

      <ol className="schedule-timeline" aria-label={`${day.dayLabel} 일정`}>
        {items.map((item) => (
          <li key={item.id} className={`${item.isDone ? "is-done" : ""}${item.id === nextItemId ? " is-next" : ""}`}>
            <button
              aria-label={`${timeOf(item.startsAt)} ${item.title}, ${item.isDone ? "완료" : "예정"}`}
              className="schedule-timeline__card"
              onClick={(event) => {
                setReturnFocusTo(event.currentTarget);
                setSelectedItem(item);
              }}
              type="button"
            >
              <time>{timeOf(item.startsAt)}</time>
              <span className="schedule-timeline__content">
                <strong>{item.title}</strong>
                <span>{item.place}</span>
                <span>{item.description}</span>
                <span className="schedule-timeline__meta">{kindLabels[item.kind]} · {item.isDone ? "완료" : "예정"}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {selectedItem ? (
        <ScheduleDetailSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          returnFocusTo={returnFocusTo}
        />
      ) : null}
    </section>
  );
}
