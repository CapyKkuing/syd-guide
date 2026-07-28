import { useState, type FormEvent } from "react";
import type { NoteView } from "../../../data/contracts";
import type { TripMutationController } from "../../../services/mutations/controller";
import { isSafeExternalHttpsUrl } from "../../../shared/externalUrls";

export function NotesPanel({
  controller,
  notes,
  tripId,
  viewerMemberId
}: {
  controller?: TripMutationController;
  notes: NoteView[];
  tripId: string;
  viewerMemberId: string;
}) {
  const [visibility, setVisibility] = useState<NoteView["visibility"]>("shared");
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [error, setError] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!controller) return;
    try {
      await controller.submit("note", "create", crypto.randomUUID(), null, {
        targetType: "trip",
        targetId: tripId,
        visibility,
        body: body.trim(),
        attachmentUrl: safeUrl(attachmentUrl)
      });
      setBody("");
      setAttachmentUrl("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "메모를 추가하지 못했습니다.");
    }
  }

  return (
    <div className="tool-panel">
      <form className="tool-inline-form" onSubmit={create}>
        <label><span>메모 공개 범위</span><select disabled={!controller} value={visibility} onChange={(event) => setVisibility(event.target.value as NoteView["visibility"])}>
          <option value="shared">함께</option><option value="personal">개인</option>
        </select></label>
        <label><span>메모 내용</span><textarea disabled={!controller} required value={body} onChange={(event) => setBody(event.target.value)} /></label>
        <label><span>첨부 주소</span><input disabled={!controller} type="url" value={attachmentUrl} onChange={(event) => setAttachmentUrl(event.target.value)} /></label>
        <button className="primary-button" disabled={!controller} type="submit">메모 추가</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="tool-entity-list">
        {notes.map((note) => (
          <li key={note.id}>
            <article>
              <p>{note.body}</p>
              <small>{note.visibility === "personal" ? "개인" : "함께"}{note.authorMemberId === viewerMemberId ? " · 내가 작성" : ""}</small>
              {isSafeExternalHttpsUrl(note.attachmentUrl) ? <a href={note.attachmentUrl} rel="noreferrer noopener" target="_blank">첨부 열기</a> : null}
              {controller && note.authorMemberId === viewerMemberId ? <button aria-label="메모 삭제" onClick={() => void controller.submit("note", "delete", note.id, note.version, null)} type="button">삭제</button> : null}
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  return isSafeExternalHttpsUrl(trimmed) ? trimmed : null;
}
