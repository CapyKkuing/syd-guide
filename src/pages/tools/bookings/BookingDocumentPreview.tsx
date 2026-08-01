import { useEffect, useState } from "react";
import type { BookingDocument } from "../../../shared/media";
import type { BookingDocumentRuntime } from "../../../services/media/bookingDocumentRuntime";

export function BookingDocumentPreview({
  document,
  runtime,
}: {
  document: BookingDocument;
  runtime?: BookingDocumentRuntime;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState(
    runtime
      ? "Drive 연결 후 이 기기에서 미리보기를 불러옵니다."
      : "Drive 미리보기는 연결된 앱에서 확인할 수 있습니다."
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function loadPreview() {
    if (!runtime) return;
    setBusy(true);
    setMessage("Drive에서 파일을 불러오는 중입니다.");
    try {
      const blob = await runtime.download(document);
      setPreviewUrl(URL.createObjectURL(blob));
      setMessage("미리보기 준비 완료");
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : "예약 파일을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="booking-document" aria-label="예약 파일">
      <header className="booking-document__heading">
        <strong>{document.originalName}</strong>
        <span>{document.mimeType === "application/pdf" ? "PDF" : "사진"}</span>
      </header>
      {previewUrl ? document.mimeType === "application/pdf" ? (
        <iframe
          className="booking-document__pdf"
          src={previewUrl}
          title={`${document.originalName} 미리보기`}
        />
      ) : (
        <img
          className="booking-document__image"
          src={previewUrl}
          alt={`${document.originalName} 미리보기`}
        />
      ) : null}
      <p aria-live="polite">{message}</p>
      {!previewUrl && runtime ? (
        <button disabled={busy} onClick={() => void loadPreview()} type="button">
          {busy ? "불러오는 중…" : "Drive 미리보기"}
        </button>
      ) : null}
    </section>
  );
}
