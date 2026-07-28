import { useCallback, useEffect, useState } from "react";

export function ReservationCode({ value }: { value: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const hide = useCallback(() => setRevealed(false), []);

  useEffect(() => {
    if (!revealed) return;
    window.addEventListener("pointerup", hide);
    window.addEventListener("pointercancel", hide);
    return () => {
      window.removeEventListener("pointerup", hide);
      window.removeEventListener("pointercancel", hide);
    };
  }, [hide, revealed]);

  if (!value) return null;
  const mask = "•".repeat(Math.min(value.length, 10));

  return (
    <div className="reservation-code">
      <span>예약번호</span>
      {revealed ? <output>{value}</output> : <span aria-hidden="true">{mask}</span>}
      <button
        aria-label="예약번호 보기"
        onBlur={hide}
        onClick={hide}
        onPointerCancel={hide}
        onPointerDown={() => setRevealed(true)}
        onPointerLeave={hide}
        onPointerUp={hide}
        type="button"
      >
        누르는 동안 보기
      </button>
    </div>
  );
}
