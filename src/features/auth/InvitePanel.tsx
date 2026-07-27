import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { createInvite, type Invite } from "./api";

function remainingSeconds(expiresAt: string) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
}

function duration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function InvitePanel() {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [qr, setQr] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!invite) return;
    let active = true;
    void QRCode.toDataURL(invite.url, { width: 240, margin: 1 }).then((url) => {
      if (active) setQr(url);
    });
    const update = () => setRemaining(remainingSeconds(invite.expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [invite]);

  async function create() {
    setLoading(true);
    setStatus("");
    setQr("");
    try {
      setInvite(await createInvite());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "초대를 만들지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.url);
    setStatus("초대 링크를 복사했습니다.");
  }

  return (
    <section className="pair-card" aria-labelledby="invite-title">
      <p className="eyebrow">ONE-TIME INVITE</p>
      <h2 id="invite-title">파트너 기기 연결</h2>
      <p>10분 동안 한 번만 사용할 수 있는 QR과 링크를 만듭니다.</p>
      <button className="primary-button" onClick={create} disabled={loading}>
        {loading ? "만드는 중…" : invite ? "새 초대 만들기" : "초대 만들기"}
      </button>

      {invite && (
        <div className="invite-result">
          {qr && <img src={qr} alt="파트너 연결 QR 코드" width="240" height="240" />}
          <strong>남은 시간 {duration(remaining)}</strong>
          <label>
            초대 링크
            <input aria-label="초대 링크" readOnly value={invite.url} />
          </label>
          <button className="secondary-button" onClick={copy}>링크 복사</button>
        </div>
      )}
      {status && <p className="form-status" role="status">{status}</p>}
    </section>
  );
}
