import { useState } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import type { TripMedia } from "../../shared/media";
import type { MediaApi, MediaPreviewInput } from "../../services/media/api";

const cropOptions: MediaPreviewInput["previewCropAspect"][] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
];

interface Props {
  api: MediaApi;
  media: TripMedia;
  onClose: () => void;
  // eslint-disable-next-line no-unused-vars
  onSaved: (saved: TripMedia) => void;
  previewUrl: string;
}

export function RepresentativePhotoEditorDialog({
  api,
  media,
  onClose,
  onSaved,
  previewUrl,
}: Props) {
  const [cropAspect, setCropAspect] = useState(media.previewCropAspect ?? "4:3");
  const [brightness, setBrightness] = useState(media.previewBrightness ?? 0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const changed = cropAspect !== (media.previewCropAspect ?? "4:3") || brightness !== (media.previewBrightness ?? 0);
  const previewClass = `representative-photo-editor__canvas representative-photo-editor__canvas--${cropAspect.replace(":", "-")}`;

  async function save() {
    if (!changed) {
      onClose();
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      onSaved(await api.savePreview(media.tripId, media.id, {
        previewCropAspect: cropAspect,
        previewBrightness: brightness,
      }));
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "대표사진 편집값을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setCropAspect("4:3");
    setBrightness(0);
  }

  return (
    <BottomSheet
      ariaLabel="대표사진 편집"
      className="representative-photo-editor"
      onClose={onClose}
      returnFocusTo={null}
    >
      <section className="representative-photo-editor__content">
        <header className="representative-photo-editor__heading">
          <p>여행 기록</p>
          <h2>대표사진 편집</h2>
          <span>원본 파일은 변경하지 않습니다.</span>
        </header>
        <section className={previewClass}>
          <img
            alt={`${media.originalName} 대표사진 미리보기`}
            src={previewUrl}
            style={{ filter: `brightness(${100 + brightness}%)` }}
          />
          <span className="representative-photo-editor__grid" />
          <p>자르기 비율과 밝기만 저장합니다.</p>
        </section>
        <section className="representative-photo-editor__controls">
          <fieldset>
            <legend>자르기 비율</legend>
            <div className="representative-photo-editor__ratio-list">
              {cropOptions.map((option) => (
                <button
                  aria-pressed={cropAspect === option}
                  className={cropAspect === option ? "is-selected" : ""}
                  key={option}
                  onClick={() => setCropAspect(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>밝기 <strong>{brightness === 0 ? "기본" : brightness > 0 ? `+${brightness}` : brightness}</strong></span>
            <input
              aria-label="밝기"
              max="20"
              min="-20"
              onChange={(event) => setBrightness(Number(event.currentTarget.value))}
              type="range"
              value={brightness}
            />
          </label>
          {message ? <p className="representative-photo-editor__message" role="alert">{message}</p> : null}
        </section>
        <footer className="representative-photo-editor__actions">
          <button className="secondary-button" disabled={saving || !changed} onClick={reset} type="button">초기화</button>
          <button className="primary-button" disabled={saving} onClick={() => void save()} type="button">
            {saving ? "저장 중…" : "미리보기 저장"}
          </button>
        </footer>
      </section>
    </BottomSheet>
  );
}
