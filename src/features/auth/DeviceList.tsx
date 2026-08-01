import { useEffect, useState } from "react";
import { getDevices, removeDevice, type Device } from "./api";

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "확인 불가" : dateTime.format(parsed);
}

export function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [status, setStatus] = useState("불러오는 중…");

  useEffect(() => {
    let active = true;
    void getDevices().then(
      (result) => {
        if (!active) return;
        setDevices(result);
        setStatus(result.length ? "" : "연결된 참여자 기기가 없습니다.");
      },
      (error: unknown) => {
        if (active) {
          setStatus(error instanceof Error ? error.message : "기기를 불러오지 못했습니다.");
        }
      }
    );
    return () => {
      active = false;
    };
  }, []);

  async function revoke(device: Device) {
    try {
      await removeDevice(device.id);
      const result = await getDevices();
      setDevices(result);
      setStatus(result.length ? "" : "연결된 참여자 기기가 없습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "기기를 해제하지 못했습니다.");
    }
  }

  return (
    <section className="pair-card" aria-labelledby="devices-title">
      <p className="eyebrow">CONNECTED DEVICES</p>
      <h2 id="devices-title">참여자 기기</h2>
      {status && <p className="form-status" role="status">{status}</p>}
      <ul className="device-list">
        {devices.map((device) => (
          <li key={device.id}>
            <div>
              <strong>{device.deviceName}</strong>
              <span>사용자 {device.memberName}</span>
              <span>마지막 사용 {date(device.lastSeenAt)}</span>
              <span>만료 {date(device.expiresAt)}</span>
            </div>
            {device.revokedAt ? (
              <span className="revoked-label">연결 해제됨</span>
            ) : (
              <button className="text-button" onClick={() => revoke(device)}>
                연결 해제
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
