import { useEffect, useState } from "react";
import {
  getAdminLoginUrl,
  getParticipantRoster,
  getPrincipal,
  isAdminAccessError,
  type ParticipantRoster,
  type SessionPrincipal,
} from "./api";
import { StatusPanel } from "../../components/StatusPanel";
import { DeviceList } from "./DeviceList";
import { InvitePanel } from "./InvitePanel";
import { ParticipantManager } from "./ParticipantManager";

export function PairingManager() {
  const [principal, setPrincipal] = useState<SessionPrincipal | null>(null);
  const [status, setStatus] = useState("권한을 확인하는 중…");
  const [roster, setRoster] = useState<ParticipantRoster | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await getPrincipal();
        if (!active) return;
        setPrincipal(result);
        if (result.role === "owner") {
          const nextRoster = await getParticipantRoster();
          if (!active) return;
          setRoster(nextRoster);
        }
        setStatus("");
      } catch (nextError) {
        if (active) {
          setError(nextError);
          setStatus(nextError instanceof Error ? nextError.message : "권한을 확인하지 못했습니다.");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (isAdminAccessError(error)) {
    return (
      <StatusPanel
        action={{ label: "관리자 다시 로그인", href: getAdminLoginUrl() }}
        description="Cloudflare Access 로그인을 다시 진행하면 참여자·초대·기기 관리로 돌아옵니다."
        kind="session-expired"
        title="관리자 로그인이 필요합니다"
      />
    );
  }

  if (!principal) {
    return <p className="form-status pairing-status" role="status">{status}</p>;
  }
  if (principal.role !== "owner") {
    return (
      <section className="pair-card admin-note" aria-labelledby="device-management-note-title">
        <p className="eyebrow">DEVICE PRIVACY</p>
        <h2 id="device-management-note-title">기기 관리는 관리자 전용</h2>
        <p>연결된 기기와 새 초대는 관리자 화면에서만 관리할 수 있어요.</p>
      </section>
    );
  }
  if (!roster) {
    return <p className="form-status pairing-status" role="status">참여자 명단을 불러오는 중…</p>;
  }
  const inviteParticipants = roster.members.filter((member) => member.isActive);
  return (
    <div className="pair-grid">
      <ParticipantManager roster={roster} onChange={setRoster} />
      <InvitePanel participants={inviteParticipants} />
      <DeviceList />
    </div>
  );
}
