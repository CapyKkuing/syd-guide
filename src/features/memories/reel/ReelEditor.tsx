import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TripMedia } from "../../../shared/media";
import type { MediaApi } from "../../../services/media/api";
import type { MediaStorageProviderClient } from "../../../services/media/provider";
import type { MediaThumbnailStore } from "../../../services/offline/mediaThumbnailStore";
import {
  addScene,
  composeReel,
  excludeScene,
  moveScene,
  replaceScene,
} from "./composeReel";
import type { ReelStore } from "./reelStore";
import type { TravelReel } from "./types";

interface Props {
  api?: Pick<MediaApi, "remove">;
  media: TripMedia[];
  onMediaChanged?: () => void | Promise<void>;
  provider?: MediaStorageProviderClient;
  store: Pick<ReelStore, "get" | "save">;
  thumbnailStore?: Pick<MediaThumbnailStore, "get" | "remove" | "save">;
  tripId: string;
}

export function ReelEditor({
  api,
  media,
  onMediaChanged,
  provider,
  store,
  thumbnailStore,
  tripId,
}: Props) {
  const [reel, setReel] = useState<TravelReel | null>(null);
  const [previousReel, setPreviousReel] = useState<TravelReel | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [similarityHashes, setSimilarityHashes] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replacementSceneId, setReplacementSceneId] = useState<string | null>(null);
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const [pendingDeleteMediaId, setPendingDeleteMediaId] = useState<string | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [removedMediaIds, setRemovedMediaIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("사진 릴을 준비하는 중입니다.");
  const createdUrls = useRef(new Set<string>());

  const visibleMedia = useMemo(
    () => media.filter((item) => !removedMediaIds.has(item.id)),
    [media, removedMediaIds]
  );
  const mediaById = useMemo(
    () => new Map(visibleMedia.map((item) => [item.id, item])),
    [visibleMedia]
  );
  const includedMediaIds = useMemo(
    () => new Set(reel?.scenes.map((scene) => scene.mediaId) ?? []),
    [reel]
  );
  const availableMedia = visibleMedia.filter((item) => !includedMediaIds.has(item.id));
  const boundedIndex = reel?.scenes.length
    ? Math.min(currentIndex, reel.scenes.length - 1)
    : 0;
  const currentScene = reel?.scenes[boundedIndex];
  const currentMedia = currentScene
    ? mediaById.get(currentScene.mediaId)
    : undefined;
  const pendingDeleteMedia = pendingDeleteMediaId
    ? availableMedia.find((item) => item.id === pendingDeleteMediaId)
    : undefined;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [saved, blobs] = await Promise.all([
          store.get(tripId),
          loadThumbnailBlobs(visibleMedia, thumbnailStore, undefined),
        ]);
        const hashes = await hashBlobs(blobs);
        if (!active) return;
        addPreviewUrls(blobs, createdUrls.current, setPreviews);
        setSimilarityHashes(hashes);
        const savedNeedsCleanup = saved
          ? reelReferencesMissingMedia(saved, visibleMedia)
          : false;
        const next = reconcileReel(saved, visibleMedia)
          ?? composeReel(visibleMedia, { similarityHashes: hashes, tripId });
        setReel(next);
        if (!saved || savedNeedsCleanup) await store.save(next);
        if (active) {
          setMessage((current) =>
            current.startsWith("사진 이력")
              ? current
              : visibleMedia.length
                ? "자동 구성을 만들었습니다. 순서와 사진을 자유롭게 바꿀 수 있습니다."
                : "여행 사진을 추가하면 자동 릴이 만들어집니다."
          );
        }
      } catch {
        if (active) setMessage("저장된 릴을 불러오지 못했습니다. 다시 시도해 주세요.");
      }
    })();
    return () => {
      active = false;
    };
  }, [store, thumbnailStore, tripId, visibleMedia]);

  useEffect(() => () => {
    for (const url of createdUrls.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (!playing || !currentScene || !reel?.scenes.length) return;
    const timer = window.setTimeout(() => {
      if (boundedIndex >= reel.scenes.length - 1) {
        setPlaying(false);
        return;
      }
      setCurrentIndex((index) => index + 1);
    }, currentScene.durationMs);
    return () => window.clearTimeout(timer);
  }, [boundedIndex, currentScene, playing, reel]);

  function commit(next: TravelReel, successMessage: string) {
    if (!reel || next === reel) return;
    setPreviousReel(reel);
    setReel(next);
    setPlaying(false);
    setCurrentIndex((index) => Math.min(index, Math.max(next.scenes.length - 1, 0)));
    setReplacementSceneId(null);
    setMessage(successMessage);
    void store.save(next).catch(() => {
      setMessage("변경사항을 기기에 저장하지 못했습니다.");
    });
  }

  function resetAutomatic() {
    commit(
      composeReel(visibleMedia, { similarityHashes, tripId }),
      "기기 내 유사도 분석으로 자동 구성을 다시 만들었습니다."
    );
  }

  function undo() {
    if (!previousReel || !reel) return;
    const restored = previousReel;
    setReel(restored);
    setPreviousReel(null);
    setPlaying(false);
    setReplacementSceneId(null);
    setCurrentIndex((index) =>
      Math.min(index, Math.max(restored.scenes.length - 1, 0))
    );
    setMessage("마지막 편집을 취소했습니다.");
    void store.save(restored).catch(() => {
      setMessage("실행 취소 내용을 기기에 저장하지 못했습니다.");
    });
  }

  async function refreshDrivePreviews() {
    if (!thumbnailStore || !provider?.connected) {
      setMessage("위 대표사진 영역에서 Google Drive를 연결한 뒤 다시 눌러 주세요.");
      return;
    }
    setMessage("Drive에서 사진 미리보기를 불러오는 중입니다.");
    try {
      const blobs = await loadThumbnailBlobs(visibleMedia, thumbnailStore, provider);
      const hashes = await hashBlobs(blobs);
      addPreviewUrls(blobs, createdUrls.current, setPreviews);
      setSimilarityHashes(hashes);
      if (reel?.mode === "auto") {
        const next = composeReel(visibleMedia, {
          similarityHashes: hashes,
          tripId,
        });
        setReel(next);
        await store.save(next);
      }
      setMessage("사진 미리보기와 기기 내 중복 분석을 새로 불러왔습니다.");
    } catch {
      setMessage("Drive 사진을 불러오지 못했습니다. 공유 권한을 확인해 주세요.");
    }
  }

  async function removeMediaHistory(item: TripMedia) {
    if (!api || deletingMediaId) return;
    setDeletingMediaId(item.id);
    setMessage("사진 이력을 삭제하는 중입니다.");
    try {
      await api.remove(tripId, item.id);
      const remainingMedia = visibleMedia.filter((mediaItem) => mediaItem.id !== item.id);
      const nextReel = reconcileReel(reel, remainingMedia)
        ?? composeReel(remainingMedia, { similarityHashes, tripId });
      setReel(nextReel);
      setPreviousReel(null);
      setCurrentIndex((index) =>
        Math.min(index, Math.max(nextReel.scenes.length - 1, 0))
      );
      setReplacementSceneId(null);
      setPendingDeleteMediaId(null);
      setRemovedMediaIds((current) => new Set(current).add(item.id));

      const previewUrl = previews[item.id];
      if (previewUrl && createdUrls.current.delete(previewUrl)) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviews((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setSimilarityHashes((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });

      let localCleanupFailed = !await retryOnce(async () => {
        await thumbnailStore?.remove(item.id);
      });
      if (!await retryOnce(() => store.save(nextReel))) {
        localCleanupFailed = true;
      }
      try {
        await onMediaChanged?.();
      } catch {
        localCleanupFailed = true;
      }
      setMessage(
        localCleanupFailed
          ? "사진 이력은 삭제됐습니다. 화면이 남아 있으면 다시 불러와 주세요. Drive 원본은 유지됩니다."
          : "사진 이력을 삭제했습니다. Google Drive 원본과 미리보기 파일은 유지됩니다."
      );
    } catch {
      setMessage("사진 이력을 삭제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setDeletingMediaId(null);
    }
  }

  if (!reel) {
    return (
      <section className="memory-reel" aria-labelledby="memory-reel-title">
        <p className="today-section-heading__eyebrow">MEMORY REEL</p>
        <h2 id="memory-reel-title">여행 사진 릴</h2>
        <p aria-live="polite">{message}</p>
      </section>
    );
  }

  return (
    <section className="memory-reel" aria-labelledby="memory-reel-title">
      <header className="memory-reel__header">
        <div>
          <p className="today-section-heading__eyebrow">MEMORY REEL</p>
          <h2 id="memory-reel-title">여행 사진 릴</h2>
          <p>사진만 사용 · 음악 없음 · 앱 안에서 미리보기</p>
        </div>
        <strong>{formatDuration(reel.durationMs)}</strong>
      </header>

      {currentScene && currentMedia ? (
        <div className="memory-reel__preview">
          {previews[currentMedia.id] ? (
            <img
              src={previews[currentMedia.id]}
              alt={`${boundedIndex + 1}번째 릴 사진`}
            />
          ) : (
            <div className="memory-reel__placeholder">
              Drive 연결 후 사진 미리보기
            </div>
          )}
          <div className="memory-reel__playback">
            <button
              className="secondary-button"
              disabled={boundedIndex === 0}
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              type="button"
            >
              이전
            </button>
            <button
              className="primary-button"
              onClick={() => setPlaying((value) => !value)}
              type="button"
            >
              {playing ? "일시정지" : "미리보기 재생"}
            </button>
            <button
              className="secondary-button"
              disabled={boundedIndex === reel.scenes.length - 1}
              onClick={() =>
                setCurrentIndex((index) =>
                  Math.min(reel.scenes.length - 1, index + 1)
                )
              }
              type="button"
            >
              다음
            </button>
          </div>
          <p>
            {boundedIndex + 1} / {reel.scenes.length} · 사진당{" "}
            {formatDuration(currentScene.durationMs)}
          </p>
        </div>
      ) : (
        <div className="memory-reel__empty">
          <p>릴에 넣을 여행 사진이 없습니다.</p>
        </div>
      )}

      <div className="memory-reel__toolbar">
        <button
          className="secondary-button"
          disabled={!previousReel}
          onClick={undo}
          type="button"
        >
          실행 취소
        </button>
        <button
          className="secondary-button"
          disabled={!visibleMedia.length}
          onClick={resetAutomatic}
          type="button"
        >
          자동 구성으로 되돌리기
        </button>
        <button
          className="text-button"
          onClick={() => void refreshDrivePreviews()}
          type="button"
        >
          Drive 미리보기 새로 불러오기
        </button>
      </div>

      <p className="memory-reel__message" aria-live="polite">{message}</p>

      {reel.scenes.length ? (
        <ol className="memory-reel__scenes" aria-label="릴 사진 순서">
          {reel.scenes.map((scene, index) => {
            const item = mediaById.get(scene.mediaId);
            if (!item) return null;
            return (
              <li
                draggable
                key={scene.id}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={() => setDraggedSceneId(scene.id)}
                onDrop={() => {
                  if (draggedSceneId) {
                    commit(
                      moveScene(reel, draggedSceneId, index),
                      "사진 순서를 바꿨습니다."
                    );
                  }
                  setDraggedSceneId(null);
                }}
              >
                {previews[item.id] ? (
                  <img src={previews[item.id]} alt="" />
                ) : (
                  <div className="memory-reel__scene-placeholder">{index + 1}</div>
                )}
                <div className="memory-reel__scene-copy">
                  <strong>{index + 1}. {item.originalName}</strong>
                  <span>{formatDuration(scene.durationMs)}</span>
                </div>
                <div className="memory-reel__scene-actions">
                  <button
                    aria-label={`${index + 1}번 사진 앞으로`}
                    className="text-button"
                    disabled={index === 0}
                    onClick={() =>
                      commit(
                        moveScene(reel, scene.id, index - 1),
                        "사진 순서를 바꿨습니다."
                      )
                    }
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`${index + 1}번 사진 뒤로`}
                    className="text-button"
                    disabled={index === reel.scenes.length - 1}
                    onClick={() =>
                      commit(
                        moveScene(reel, scene.id, index + 1),
                        "사진 순서를 바꿨습니다."
                      )
                    }
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setReplacementSceneId(scene.id)}
                    type="button"
                  >
                    교체
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      commit(
                        excludeScene(reel, scene.id),
                        "사진을 릴에서 제외했습니다."
                      )
                    }
                    type="button"
                  >
                    제외
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {replacementSceneId ? (
        <div className="memory-reel__replacement">
          <div className="memory-reel__subheading">
            <h3>교체할 사진 선택</h3>
            <button
              className="text-button"
              onClick={() => setReplacementSceneId(null)}
              type="button"
            >
              취소
            </button>
          </div>
          {availableMedia.length ? (
            <div className="memory-reel__gallery">
              {availableMedia.map((item) => (
                <PhotoChoice
                  actionLabel={`${item.originalName}로 교체`}
                  key={item.id}
                  item={item}
                  onChoose={() =>
                    commit(
                      replaceScene(reel, replacementSceneId, item),
                      "사진을 같은 위치에서 교체했습니다."
                    )
                  }
                  preview={previews[item.id]}
                />
              ))}
            </div>
          ) : (
            <p>교체할 수 있는 제외 사진이 없습니다.</p>
          )}
        </div>
      ) : null}

      {availableMedia.length ? (
        <div className="memory-reel__excluded">
          <div className="memory-reel__subheading">
            <h3>제외 사진 {availableMedia.length}장</h3>
            <span>원본 사진은 삭제되지 않습니다.</span>
          </div>
          <div className="memory-reel__gallery">
            {availableMedia.map((item) => (
              <PhotoChoice
                actionLabel="릴에 추가"
                deleteDisabled={Boolean(deletingMediaId)}
                key={item.id}
                item={item}
                onChoose={() =>
                  commit(
                    addScene(reel, item),
                    "사진을 릴 끝에 추가했습니다."
                  )
                }
                onDeleteRequest={api ? () => setPendingDeleteMediaId(item.id) : undefined}
                preview={previews[item.id]}
              />
            ))}
          </div>
          {pendingDeleteMedia ? (
            <div
              aria-labelledby="memory-reel-delete-title"
              aria-modal="true"
              className="memory-reel__delete-confirm"
              role="alertdialog"
            >
              <div>
                <strong id="memory-reel-delete-title">{pendingDeleteMedia.originalName} 이력을 삭제할까요?</strong>
                <span>앱 기록에서만 지우며 Google Drive 원본과 미리보기 파일은 유지합니다.</span>
              </div>
              <div className="memory-reel__delete-actions">
                <button
                  className="secondary-button"
                  disabled={Boolean(deletingMediaId)}
                  onClick={() => setPendingDeleteMediaId(null)}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="danger-button"
                  disabled={Boolean(deletingMediaId)}
                  onClick={() => void removeMediaHistory(pendingDeleteMedia)}
                  type="button"
                >
                  {deletingMediaId ? "삭제 중…" : "이력 삭제 확인"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PhotoChoice({
  actionLabel,
  deleteDisabled = false,
  item,
  onChoose,
  onDeleteRequest,
  preview,
}: {
  actionLabel: string;
  deleteDisabled?: boolean;
  item: TripMedia;
  onChoose: () => void;
  onDeleteRequest?: () => void;
  preview?: string;
}) {
  return (
    <article className="memory-reel__choice">
      {preview ? (
        <img src={preview} alt={item.originalName} />
      ) : (
        <div className="memory-reel__choice-placeholder">미리보기 없음</div>
      )}
      <strong>{item.originalName}</strong>
      <div className="memory-reel__choice-actions">
        <button className="secondary-button" onClick={onChoose} type="button">
          {actionLabel}
        </button>
        {onDeleteRequest ? (
          <button
            aria-label={`${item.originalName} 이력 삭제`}
            className="danger-button"
            disabled={deleteDisabled}
            onClick={onDeleteRequest}
            type="button"
          >
            이력 삭제
          </button>
        ) : null}
      </div>
    </article>
  );
}

function reconcileReel(
  saved: TravelReel | null,
  media: TripMedia[]
): TravelReel | null {
  if (!saved) return null;
  const mediaIds = new Set(media.map((item) => item.id));
  const scenes = saved.scenes.filter((scene) => mediaIds.has(scene.mediaId));
  if (!scenes.length && media.length) return null;
  const included = new Set(scenes.map((scene) => scene.mediaId));
  return {
    ...saved,
    scenes,
    excludedMediaIds: saved.excludedMediaIds.filter(
      (mediaId) => mediaIds.has(mediaId) && !included.has(mediaId)
    ),
    durationMs: scenes.reduce((total, scene) => total + scene.durationMs, 0),
  };
}

function reelReferencesMissingMedia(
  reel: TravelReel,
  media: TripMedia[]
): boolean {
  const mediaIds = new Set(media.map((item) => item.id));
  return reel.scenes.some((scene) => !mediaIds.has(scene.mediaId))
    || reel.excludedMediaIds.some((mediaId) => !mediaIds.has(mediaId));
}

async function retryOnce(action: () => Promise<void>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await action();
      return true;
    } catch {
      if (attempt === 1) return false;
    }
  }
  return false;
}

async function loadThumbnailBlobs(
  media: TripMedia[],
  store: Pick<MediaThumbnailStore, "get" | "save"> | undefined,
  provider: MediaStorageProviderClient | undefined
): Promise<Record<string, Blob>> {
  if (!store) return {};
  const blobs: Record<string, Blob> = {};
  for (const item of media) {
    let blob = await store.get(item.id);
    if (!blob && provider?.connected) {
      blob = await provider.download(item.thumbnailObjectId);
      await store.save(item.id, item.tripId, blob);
    }
    if (blob) blobs[item.id] = blob;
  }
  return blobs;
}

async function hashBlobs(
  blobs: Readonly<Record<string, Blob>>
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  await Promise.all(Object.entries(blobs).map(async ([mediaId, blob]) => {
    try {
      hashes[mediaId] = await perceptualHash(blob);
    } catch {
      return;
    }
  }));
  return hashes;
}

async function perceptualHash(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas unavailable");
    context.drawImage(bitmap, 0, 0, 8, 8);
    const data = context.getImageData(0, 0, 8, 8).data;
    const luminance: number[] = [];
    for (let index = 0; index < data.length; index += 4) {
      luminance.push(
        0.2126 * (data[index] ?? 0)
        + 0.7152 * (data[index + 1] ?? 0)
        + 0.0722 * (data[index + 2] ?? 0)
      );
    }
    const average = luminance.reduce((sum, value) => sum + value, 0)
      / luminance.length;
    return luminance.map((value) => value >= average ? "1" : "0").join("");
  } finally {
    bitmap.close();
  }
}

function addPreviewUrls(
  blobs: Readonly<Record<string, Blob>>,
  createdUrls: Set<string>,
  setPreviews: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
  setPreviews((current) => {
    const next = { ...current };
    for (const [mediaId, blob] of Object.entries(blobs)) {
      if (next[mediaId]) continue;
      const url = URL.createObjectURL(blob);
      createdUrls.add(url);
      next[mediaId] = url;
    }
    return next;
  });
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
