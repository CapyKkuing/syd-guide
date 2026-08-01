import { useEffect, useState } from "react";
import {
  getParticipantRoster,
  getPrincipal,
  type ParticipantRoster,
  type SessionPrincipal,
} from "./api";
import { DeviceList } from "./DeviceList";
import { InvitePanel } from "./InvitePanel";
import { ParticipantManager } from "./ParticipantManager";

export function PairingManager() {
  const [principal, setPrincipal] = useState<SessionPrincipal | null>(null);
  const [status, setStatus] = useState("권한을 확인하는 중…");
  const [roster, setRoster] = useState<ParticipantRoster | null>(null);

  useEffect(() => {
    let active = true;
    void getPrincipal().then(async (result) => {
        if (!active) return;
        setPrincipal(result);
        if (result.role === "owner") {
          const nextRoster = await getParticipantRoster();
          if (!active) return;
          setRoster(nextRoster);
        }
        setStatus("");
      },
      (error: unknown) => {
        if (active) {
          setStatus(error instanceof Error ? error.message : "권한을 확인하지 못했습니다.");
        }
      }
    );
    return () => {
      active = false;
    };
  }, []);

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
  const inviteParticipants = roster.members.filter(
    (member) => member.isActive && member.id !== "owner"
  );
  return (
    <div className="pair-grid">
      <ParticipantManager roster={roster} onChange={setRoster} />
      <InvitePanel participants={inviteParticipants} />
      <DeviceList />
    </div>
  );
}
