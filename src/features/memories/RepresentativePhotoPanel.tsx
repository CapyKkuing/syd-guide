import { useEffect, useMemo, useRef, useState } from "react";
import type { TripSummaryViewModel } from "../../data/contracts";
import type { TripMedia, TripMediaStorage } from "../../shared/media";
import type { MediaThumbnailStore } from "../../services/offline/mediaThumbnailStore";
import type { MediaApi } from "../../services/media/api";
import type { MediaStorageProviderClient } from "../../services/media/provider";
import {
  rankPhotos,
  type RankedPhoto,
} from "../../services/media/localPhotoRanker";
import { RepresentativePhotoEditorDialog } from "./RepresentativePhotoEditorDialog";

const MAX_PHOTOS = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PREVIEW_FOLDER_NAME = "앱 미리보기";
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Props {
  api?: MediaApi;
  media: TripMedia[];
  onChanged: () => void;
  provider?: MediaStorageProviderClient;
  ranker?: typeof rankPhotos;
  storage: TripMediaStorage | null;
  thumbnailStore?: Pick<MediaThumbnailStore, "get" | "remove" | "save">;
  trip: TripSummaryViewModel;
  viewerRole: "owner" | "partner";
}

export function RepresentativePhotoPanel({
  api,
  media,
  onChanged,
  provider,
  ranker = rankPhotos,
  storage: initialStorage,
  thumbnailStore,
  trip,
  viewerRole,
}: Props) {
  const [items, setItems] = useState(media);
  const [storage, setStorage] = useState(initialStorage);
  const [representativeId, setRepresentativeId] = useState(
    trip.representativeMediaId
  );
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [message, setMessage] = useState(
    api
      ? "사진은 내 Google Drive에 저장되고 AI 분석은 이 기기에서만 실행됩니다."
      : "읽기 전용 미리보기에서는 사진을 연결할 수 없습니다."
  );
  const createdUrls = useRef(new Set<string>());

  const candidates = useMemo(
    () => [...items]
      .filter((item) => item.aiScore !== null)
      .sort((left, right) => (right.aiScore ?? 0) - (left.aiScore ?? 0))
      .slice(0, 3),
    [items]
  );
  const representative = items.find((item) => item.id === representativeId);
  const coverUrl = representative ? previews[representative.id] : undefined;

  useEffect(() => {
    if (!representative || !thumbnailStore || previews[representative.id]) return;
    let active = true;
    void thumbnailStore.get(representative.id).then((blob) => {
      if (!blob || !active) return;
      const url = URL.createObjectURL(blob);
      createdUrls.current.add(url);
      setPreviews((current) => ({ ...current, [representative.id]: url }));
    });
    return () => {
      active = false;
    };
  }, [previews, representative, thumbnailStore]);

  useEffect(() => () => {
    for (const url of createdUrls.current) URL.revokeObjectURL(url);
  }, []);

  async function connect(): Promise<TripMediaStorage | null> {
    if (!api || !provider) return null;
    const config = await api.getConfig(trip.id);
    if (!config.clientId) {
      throw new Error(
        "Google OAuth client ID가 아직 설정되지 않았습니다. 공개 연결 전 관리자 설정이 필요합니다."
      );
    }
    await provider.connect(config.clientId);
    if (storage) return storage;
    if (viewerRole !== "owner") {
      throw new Error(
        "여행 소유자가 먼저 Google Drive 폴더를 만들고 공유해야 합니다."
      );
    }
    const folder = await provider.createFolder(`${trip.title} 여행 사진`);
    const saved = await api.saveStorage(trip.id, folder.id);
    setStorage(saved);
    return saved;
  }

  async function handleConnect() {
    setBusy(true);
    setMessage("Google Drive 연결 창을 여는 중입니다.");
    try {
      const connected = await connect();
      if (connected) {
        setMessage("Google Drive가 연결되었습니다. 이제 사진을 선택할 수 있습니다.");
        await loadRepresentativeFromDrive();
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !api || !provider || !thumbnailStore) return;
    const files = Array.from(fileList);
    const issue = validateFiles(files);
    if (issue) {
      setMessage(issue);
      return;
    }
    setBusy(true);
    try {
      const connectedStorage = provider.connected ? storage : await connect();
      if (!connectedStorage) throw new Error("Google Drive 폴더를 연결해 주세요.");
      setMessage(`사진 ${files.length}장을 기기에서 분석하는 중입니다.`);
      const ranked = await ranker(files);
      const previewFolder = await provider.findFolder?.(
        PREVIEW_FOLDER_NAME,
        connectedStorage.rootObjectId
      ) ?? await provider.createFolder(
        PREVIEW_FOLDER_NAME,
        connectedStorage.rootObjectId
      );
      const uploaded: TripMedia[] = [];
      for (let index = 0; index < ranked.length; index += 1) {
        setMessage(`추천 점수 계산 완료 · Drive 업로드 ${index + 1}/${ranked.length}`);
        const photo = ranked[index];
        if (photo) {
          uploaded.push(await uploadPhoto(connectedStorage, previewFolder.id, photo));
          const completed = [...uploaded];
          setItems((current) => [
            ...completed,
            ...current.filter((item) => !completed.some((saved) => saved.id === item.id)),
          ]);
        }
      }
      setMessage(
        `업로드 완료 · AI 추천 상위 ${Math.min(uploaded.length, 3)}장에서 대표사진을 골라 주세요.`
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(
    connectedStorage: TripMediaStorage,
    previewRootObjectId: string,
    photo: RankedPhoto
  ): Promise<TripMedia> {
    if (!api || !provider || !thumbnailStore) {
      throw new Error("사진 저장 기능을 준비하지 못했습니다.");
    }
    const prefix = `${Date.now()}-${crypto.randomUUID()}`;
    const safeName = photo.file.name.replace(/[^A-Za-z0-9._-]/g, "_");
    const original = await provider.upload(
      connectedStorage.rootObjectId,
      `${prefix}-${safeName}`,
      photo.file
    );
    let thumbnailId: string | null = null;
    let registeredMediaId: string | null = null;
    try {
      const thumbnail = await provider.upload(
        previewRootObjectId,
        `${prefix}-thumb.webp`,
        photo.thumbnail
      );
      thumbnailId = thumbnail.id;
      const saved = await api.register(trip.id, {
        providerObjectId: original.id,
        thumbnailObjectId: thumbnail.id,
        originalName: photo.file.name,
        mimeType: photo.file.type as TripMedia["mimeType"],
        width: photo.width,
        height: photo.height,
        capturedAt: photo.capturedAt,
        aiScore: photo.score,
        aiLabels: photo.labels,
      });
      registeredMediaId = saved.id;
      await thumbnailStore.save(saved.id, trip.id, photo.thumbnail);
      const url = URL.createObjectURL(photo.thumbnail);
      createdUrls.current.add(url);
      setPreviews((current) => ({ ...current, [saved.id]: url }));
      return saved;
    } catch (error) {
      await Promise.allSettled([
        ...(registeredMediaId ? [api.remove(trip.id, registeredMediaId)] : []),
        provider.remove(original.id),
        ...(thumbnailId ? [provider.remove(thumbnailId)] : []),
      ]);
      throw error;
    }
  }

  async function chooseRepresentative(mediaId: string) {
    if (!api) return;
    setBusy(true);
    try {
      await api.selectRepresentative(trip.id, mediaId);
      setRepresentativeId(mediaId);
      setMessage("대표사진을 저장했습니다.");
      window.setTimeout(onChanged, 1_200);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeRepresentativeHistory() {
    if (!api || !representative || !thumbnailStore) return;
    setBusy(true);
    setMessage("대표사진 이력을 삭제하는 중입니다.");
    try {
      await api.remove(trip.id, representative.id);
      let localCleanupFailed = false;
      try {
        await thumbnailStore.remove(representative.id);
      } catch {
        localCleanupFailed = true;
      }

      const previewUrl = previews[representative.id];
      if (previewUrl && createdUrls.current.delete(previewUrl)) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviews((current) => {
        const next = { ...current };
        delete next[representative.id];
        return next;
      });
      setItems((current) => current.filter((item) => item.id !== representative.id));
      setRepresentativeId(null);
      setEditorOpen(false);
      setDeleteOpen(false);
      try {
        await onChanged();
      } catch {
        localCleanupFailed = true;
      }
      setMessage(
        localCleanupFailed
          ? "대표사진 이력은 삭제됐습니다. 화면이 남아 있으면 다시 불러와 주세요. Google Drive 원본은 유지됩니다."
          : "대표사진 이력을 삭제했습니다. Google Drive 원본과 미리보기 파일은 유지됩니다."
      );
    } catch {
      setMessage("대표사진 이력을 삭제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function loadRepresentativeFromDrive() {
    if (!representative || !provider || !thumbnailStore || !provider.connected) return;
    if (previews[representative.id]) return;
    try {
      const blob = await provider.download(representative.thumbnailObjectId);
      await thumbnailStore.save(representative.id, trip.id, blob);
      const url = URL.createObjectURL(blob);
      createdUrls.current.add(url);
      setPreviews((current) => ({ ...current, [representative.id]: url }));
    } catch {
      setMessage("대표사진을 불러오지 못했습니다. Drive 공유 권한을 확인해 주세요.");
    }
  }

  return (
    <div className="representative-photo">
      <figure className={`representative-photo__figure representative-photo__figure--${(representative?.previewCropAspect ?? "4:3").replace(":", "-")}`}>
        <img
          className="today-hero__cover"
          src={coverUrl || trip.coverImageUrl}
          alt={`${trip.destination} 여행 대표 사진`}
          style={representative ? { filter: `brightness(${100 + (representative.previewBrightness ?? 0)}%)` } : undefined}
        />
        <figcaption>
          {representativeId
            ? coverUrl
              ? "여행 사진 중 기기 내 AI 추천 대표사진"
              : "Drive 연결 후 저장된 대표사진을 표시합니다."
            : "사진을 올리면 기기 내 AI가 대표사진 후보를 추천합니다."}
        </figcaption>
      </figure>

      <div className="representative-photo__controls">
        <div className="representative-photo__actions">
          <button
            className="secondary-button"
            disabled={busy || !api}
            onClick={() => void handleConnect()}
            type="button"
          >
            {provider?.connected ? "Drive 다시 연결" : "Google Drive 연결"}
          </button>
          {storage && provider ? (
            <a
              className="text-button"
              href={provider.folderUrl(storage.rootObjectId)}
              rel="noreferrer"
              target="_blank"
            >
              Drive에서 공유 설정
            </a>
          ) : null}
          {representative && coverUrl && api ? (
            <button className="secondary-button" disabled={busy} onClick={() => setEditorOpen(true)} type="button">
              대표사진 편집
            </button>
          ) : null}
          {representative && api ? (
            <button className="danger-button" disabled={busy} onClick={() => setDeleteOpen(true)} type="button">
              대표사진 삭제
            </button>
          ) : null}
        </div>
        <label className={busy || !api ? "photo-upload is-disabled" : "photo-upload"}>
          <span>{busy ? "처리 중…" : "여행 사진 선택"}</span>
          <input
            accept="image/jpeg,image/png,image/webp"
            disabled={busy || !api}
            multiple
            onChange={(event) => {
              void handleFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
        <p className="representative-photo__message" aria-live="polite">{message}</p>
        {deleteOpen && representative ? (
          <div
            aria-labelledby="representative-photo-delete-title"
            aria-modal="true"
            className="representative-photo__delete-confirm"
            role="alertdialog"
          >
            <div>
              <strong id="representative-photo-delete-title">{representative.originalName} 대표사진 이력을 삭제할까요?</strong>
              <span>앱 기록에서만 지우며 Google Drive 원본과 미리보기 파일은 유지합니다.</span>
            </div>
            <div className="representative-photo__delete-actions">
              <button className="secondary-button" disabled={busy} onClick={() => setDeleteOpen(false)} type="button">
                취소
              </button>
              <button className="danger-button" disabled={busy} onClick={() => void removeRepresentativeHistory()} type="button">
                {busy ? "삭제 중…" : "앱 이력 삭제 확인"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {candidates.length ? (
        <div className="representative-photo__candidates" aria-label="AI 추천 대표사진 후보">
          {candidates.map((candidate, index) => (
            <article key={candidate.id} className={candidate.id === representativeId ? "photo-candidate is-selected" : "photo-candidate"}>
              {previews[candidate.id] ? (
                <img src={previews[candidate.id]} alt={`AI 추천 후보 ${index + 1}`} />
              ) : (
                <div className="photo-candidate__placeholder">Drive 연결 후 미리보기</div>
              )}
              <p>추천 {Math.round((candidate.aiScore ?? 0) * 100)}점</p>
              <button
                className="secondary-button"
                disabled={busy || candidate.id === representativeId}
                onClick={() => void chooseRepresentative(candidate.id)}
                type="button"
              >
                {candidate.id === representativeId ? "대표사진" : "대표사진으로 선택"}
              </button>
            </article>
          ))}
        </div>
      ) : null}
      {editorOpen && representative && coverUrl && api ? (
        <RepresentativePhotoEditorDialog
          api={api}
          media={representative}
          onClose={() => setEditorOpen(false)}
          onSaved={(saved) => {
            setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
            setMessage("대표사진 미리보기를 저장했습니다.");
            onChanged();
          }}
          previewUrl={coverUrl}
        />
      ) : null}
    </div>
  );
}

function validateFiles(files: File[]): string | null {
  if (!files.length) return "사진을 선택해 주세요.";
  if (files.length > MAX_PHOTOS) return `한 번에 최대 ${MAX_PHOTOS}장까지 선택할 수 있습니다.`;
  if (files.some((file) => !SUPPORTED_TYPES.has(file.type))) {
    return "JPG, PNG, WebP 사진만 올릴 수 있습니다.";
  }
  if (files.some((file) => file.size > MAX_FILE_BYTES)) {
    return "사진 한 장은 25MB 이하여야 합니다.";
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "사진 처리 중 오류가 발생했습니다.";
}
