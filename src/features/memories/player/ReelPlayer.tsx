import { useEffect, useMemo, useRef, useState } from "react";
import { AppLink } from "../../../components/AppLink";
import type { TripMedia } from "../../../shared/media";
import type { MediaStorageProviderClient } from "../../../services/media/provider";
import type { MediaThumbnailStore } from "../../../services/offline/mediaThumbnailStore";
import type { TravelReel } from "../reel/types";
import { useReelPlayback } from "./useReelPlayback";

interface Props {
  editHref: string;
  exitHref: string;
  media: TripMedia[];
  provider?: MediaStorageProviderClient;
  reel: TravelReel;
  thumbnailStore?: Pick<MediaThumbnailStore, "get" | "save">;
  tripId: string;
  tripTitle: string;
}

export function ReelPlayer({
  editHref,
  exitHref,
  media,
  provider,
  reel,
  thumbnailStore,
  tripId,
  tripTitle,
}: Props) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewMessage, setPreviewMessage] = useState("");
  const createdUrls = useRef(new Set<string>());
  const mediaById = useMemo(
    () => new Map(media.map((item) => [item.id, item])),
    [media]
  );
  const playback = useReelPlayback(reel, tripId);
  const currentMedia = playback.scene
    ? mediaById.get(playback.scene.mediaId)
    : undefined;
  const currentPreview = currentMedia
    ? previews[currentMedia.id]
    : undefined;

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!thumbnailStore) {
        setPreviewMessage("이 기기에서 사진 미리보기를 찾지 못했습니다.");
        return;
      }
      const loaded: Record<string, string> = {};
      try {
        for (const scene of reel.scenes) {
          const item = mediaById.get(scene.mediaId);
          if (!item) continue;
          let blob = await thumbnailStore.get(item.id);
          if (!blob && provider?.connected) {
            blob = await provider.download(item.thumbnailObjectId);
            await thumbnailStore.save(item.id, item.tripId, blob);
          }
          if (!blob || !active) continue;
          const url = URL.createObjectURL(blob);
          createdUrls.current.add(url);
          loaded[item.id] = url;
        }
        if (!active) return;
        setPreviews(loaded);
        if (!Object.keys(loaded).length) {
          setPreviewMessage(
            "편집 화면에서 Google Drive 미리보기를 먼저 불러와 주세요."
          );
        }
      } catch {
        if (active) {
          setPreviewMessage(
            "사진을 불러오지 못했습니다. Drive 공유 권한을 확인해 주세요."
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [mediaById, provider, reel.scenes, thumbnailStore]);

  useEffect(() => () => {
    for (const url of createdUrls.current) URL.revokeObjectURL(url);
  }, []);

  if (!reel.scenes.length || !currentMedia) {
    return (
      <main className="reel-player reel-player--empty">
        <p>재생할 사진이 없습니다.</p>
        <AppLink className="reel-player__empty-link" href={editHref}>
          릴 편집으로 돌아가기
        </AppLink>
      </main>
    );
  }

  const controlsVisible =
    playback.state.controlsVisible
    || playback.state.resumePromptVisible
    || playback.state.completed;

  return (
    <main className="reel-player" aria-label={`${tripTitle} 사진 릴 플레이어`}>
      <div className="reel-player__canvas">
        {currentPreview ? (
          <>
            <img
              aria-hidden="true"
              className="reel-player__background"
              src={currentPreview}
            />
            <img
              className="reel-player__photo"
              src={currentPreview}
              alt={`${playback.state.sceneIndex + 1}번째 여행 사진`}
            />
          </>
        ) : (
          <div className="reel-player__placeholder">
            <span>{previewMessage || "사진 미리보기를 불러오는 중입니다."}</span>
          </div>
        )}

        <button
          aria-label="이전 사진"
          className="reel-player__tap-zone reel-player__tap-zone--previous"
          disabled={playback.state.sceneIndex === 0}
          onClick={playback.previous}
          type="button"
        />
        <button
          aria-label="재생 컨트롤 표시"
          className="reel-player__tap-zone reel-player__tap-zone--controls"
          onClick={playback.showControls}
          type="button"
        />
        <button
          aria-label="다음 사진"
          className="reel-player__tap-zone reel-player__tap-zone--next"
          disabled={
            playback.state.sceneIndex === reel.scenes.length - 1
          }
          onClick={playback.next}
          type="button"
        />
      </div>

      <div
        aria-hidden={!controlsVisible}
        className={
          controlsVisible
            ? "reel-player__controls is-visible"
            : "reel-player__controls"
        }
      >
        <div className="reel-player__progress" aria-hidden="true">
          {reel.scenes.map((scene, index) => {
            const progress = index < playback.state.sceneIndex
              ? 1
              : index === playback.state.sceneIndex
                ? playback.progress
                : 0;
            return (
              <span className="reel-player__progress-track" key={scene.id}>
                <span style={{ transform: `scaleX(${progress})` }} />
              </span>
            );
          })}
        </div>

        <header className="reel-player__header">
          <AppLink
            className="reel-player__control-link"
            href={exitHref}
            tabIndex={controlsVisible ? 0 : -1}
          >
            닫기
          </AppLink>
          <strong>{tripTitle}</strong>
          <AppLink
            className="reel-player__control-link"
            href={editHref}
            tabIndex={controlsVisible ? 0 : -1}
          >
            편집
          </AppLink>
        </header>

        <footer className="reel-player__footer">
          <div>
            <strong>
              {playback.state.sceneIndex + 1} / {reel.scenes.length}
            </strong>
            <span>사진만 사용 · 음악 없음</span>
          </div>
          <button
            aria-label={playback.state.playing ? "일시정지" : "재생"}
            className="reel-player__pause"
            disabled={playback.state.completed}
            onClick={playback.togglePause}
            tabIndex={controlsVisible ? 0 : -1}
            type="button"
          >
            {playback.state.playing ? "Ⅱ" : "▶"}
          </button>
        </footer>
      </div>

      {playback.state.resumePromptVisible ? (
        <div
          aria-labelledby="reel-resume-title"
          aria-modal="true"
          className="reel-player__dialog"
          role="dialog"
        >
          <div>
            <p>MEMORY REEL</p>
            <h1 id="reel-resume-title">이어서 볼까요?</h1>
            <span>
              {playback.state.sceneIndex + 1}번째 사진 처음부터 이어집니다.
            </span>
            <button onClick={playback.resume} type="button">
              이어보기
            </button>
            <button onClick={playback.restart} type="button">
              처음부터
            </button>
          </div>
        </div>
      ) : null}

      {playback.state.completed ? (
        <div className="reel-player__complete" role="status">
          <p>여행 사진을 모두 봤습니다.</p>
          <button onClick={playback.restart} type="button">
            처음부터 다시 보기
          </button>
          <AppLink href={editHref}>릴 편집하기</AppLink>
        </div>
      ) : null}
    </main>
  );
}
