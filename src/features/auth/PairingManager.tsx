import { useEffect, useState } from "react";
import { getPrincipal, type SessionPrincipal } from "./api";
import { DeviceList } from "./DeviceList";
import { InvitePanel } from "./InvitePanel";

export function PairingManager() {
  const [principal, setPrincipal] = useState<SessionPrincipal | null>(null);
  const [status, setStatus] = useState("권한을 확인하는 중…");

  useEffect(() => {
    let active = true;
    void getPrincipal().then(
      (result) => {
        if (!active) return;
        setPrincipal(result);
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
    return <p className="form-status" role="status">{status}</p>;
  }
  if (principal.role !== "owner") {
    return (
      <section className="pair-card admin-note">
        <p className="eyebrow">DEVICE PRIVACY</p>
        <h2>기기 관리는 관리자 전용</h2>
        <p>연결된 기기와 새 초대는 관리자 화면에서만 관리할 수 있어요.</p>
      </section>
    );
  }
  return (
    <div className="pair-grid">
      <InvitePanel />
      <DeviceList />
    </div>
  );
}
