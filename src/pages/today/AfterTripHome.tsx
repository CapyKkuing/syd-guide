import {
  pathForMemories,
  pathForMemoryPlayer,
} from "../../app/router";
import { AppLink } from "../../components/AppLink";
import { ExpensePanel } from "./ExpensePanel";
import { SettlementPanel } from "./SettlementPanel";
import type { TodayHomeProps } from "./todayHomeTypes";
import { RepresentativePhotoPanel } from "../../features/memories/RepresentativePhotoPanel";
import { ReelEditor } from "../../features/memories/reel/ReelEditor";
import { defaultReelStore } from "../../features/memories/reel/reelStore";

export function AfterTripHome({
  members,
  settlementTransfers = [],
  media = [],
  mediaApi,
  mediaProvider,
  mediaStorage = null,
  mediaThumbnailStore,
  mutationController,
  onMediaChanged = () => undefined,
  today,
  trip,
  viewerMemberId,
  viewerRole = "owner",
}: TodayHomeProps) {
  return (
    <div className="today-page today-home today-home--after">
      <section className="today-hero today-hero--completed" aria-labelledby="today-hero-title">
        <div className="today-hero__copy">
          <p className="today-hero__eyebrow">귀국 후</p>
          <h2 id="today-hero-title">여행을 다시 봅니다</h2>
          <p className="today-hero__summary">{trip.startDate} — {trip.endDate}</p>
          <p className="today-hero__detail">{today.summary
            ? `방문 장소 ${today.summary.visitedPlaceCount}곳 · 완료 일정 ${today.summary.completedItemCount}개`
            : "여행 기록을 정리하는 중입니다."}</p>
          <AppLink
            className="primary-button today-hero__action"
            href={pathForMemories(trip.id)}
          >
            여행 기록 보기
          </AppLink>
        </div>
        <RepresentativePhotoPanel
          key={`${trip.id}:${trip.updatedAt}`}
          api={mediaApi}
          media={media}
          onChanged={onMediaChanged}
          provider={mediaProvider}
          storage={mediaStorage}
          thumbnailStore={mediaThumbnailStore}
          trip={trip}
          viewerRole={viewerRole}
        />
      </section>

      <ReelEditor
        media={media}
        provider={mediaProvider}
        store={defaultReelStore}
        thumbnailStore={mediaThumbnailStore}
        tripId={trip.id}
      />
      <AppLink
        className="primary-button memory-reel__open-player"
        href={pathForMemoryPlayer(trip.id)}
      >
        다시 여행 보기
      </AppLink>

      <SettlementPanel
        controller={mutationController}
        expenses={today.expenses}
        members={members}
        transfers={settlementTransfers}
      />

      <ExpensePanel
        controller={mutationController}
        expenses={today.expenses}
        localDate={today.localDate}
        members={members}
        mode="after"
        viewerMemberId={viewerMemberId}
      />
    </div>
  );
}
