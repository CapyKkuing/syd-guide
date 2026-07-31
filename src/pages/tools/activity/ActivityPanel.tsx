import { Button } from "@astryxdesign/core";
import type { ActivityView } from "../../../data/contracts";

export function ActivityPanel({
  activity,
  now = new Date(),
  reload
}: {
  activity: ActivityView[];
  now?: Date;
  reload: () => void;
}) {
  const latest = [...activity]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 100);
  return (
    <article className="tool-card tool-card--wide" id="activity">
      <div className="tool-card__heading">
        <h1>최근 활동</h1>
        <Button className="activity-refresh-action" label="활동 새로고침" onClick={reload} size="sm" variant="secondary" />
      </div>
      <ul className="activity-list">
        {latest.map((entry) => <li key={entry.id}><p>{entry.summary}</p><time dateTime={entry.createdAt}>{relativeTime(entry.createdAt, now)}</time></li>)}
      </ul>
      {latest.length === 0 ? <p>아직 기록된 활동이 없습니다.</p> : null}
    </article>
  );
}

function relativeTime(value: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}
