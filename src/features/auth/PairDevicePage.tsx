import { useState, type FormEvent } from "react";
import { navigateToLibrary } from "../../app/router";
import { claimDevice } from "./api";

export function PairDevicePage({ token }: { token: string | null }) {
  const [deviceName, setDeviceName] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setStatus("");
    try {
      await claimDevice(token, deviceName.trim());
      navigateToLibrary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "기기를 연결하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pair-page">
      <section className="pair-card pair-card--claim" aria-labelledby="pair-title">
        <p className="eyebrow">JOIN OUR JOURNEY</p>
        <h1 id="pair-title">둘만의 여행에 연결</h1>
        {!token ? (
          <p className="form-status" role="alert">
            초대 링크가 없거나 이미 주소에서 제거되었습니다.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              이 기기 이름
              <input
                required
                maxLength={80}
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="예: 연준 iPhone"
              />
            </label>
            <button className="primary-button" disabled={loading}>
              {loading ? "연결하는 중…" : "기기 연결"}
            </button>
          </form>
        )}
        {status && <p className="form-status" role="alert">{status}</p>}
      </section>
    </main>
  );
}
