import { BottomSheet } from "../../components/BottomSheet";
import type { TripLibrarySummary } from "./api";

function purgeState(
  purgeAfter: string | null,
  now: Date
): { label: string; expired: boolean } {
  if (!purgeAfter) {
    return { label: "복구 기간이 만료되었습니다.", expired: true };
  }
  const purgeDate = new Date(purgeAfter);
  if (Number.isNaN(purgeDate.getTime()) || purgeDate.getTime() <= now.getTime()) {
    return { label: "복구 기간이 만료되었습니다.", expired: true };
  }
  const remaining = Math.ceil(
    (purgeDate.getTime() - now.getTime()) / 86_400_000
  );
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(purgeDate);
  return {
    label: `${formatted} 자동 삭제 · ${remaining}일 남음`,
    expired: false
  };
}

export function TrashPanel({
  status,
  trips,
  error,
  mutationError,
  now,
  submitting,
  onRetry,
  onRestore,
  onClose,
  returnFocusTo
}: {
  status: "loading" | "ready" | "error";
  trips: TripLibrarySummary[];
  error?: string;
  mutationError?: string;
  now: Date;
  submitting: boolean;
  onRetry: () => void;
  // ESLint's base rule does not recognize TypeScript function arguments.
  // eslint-disable-next-line no-unused-vars
  onRestore: (trip: TripLibrarySummary) => Promise<boolean>;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  return (
    <BottomSheet ariaLabel="휴지통" onClose={onClose} returnFocusTo={returnFocusTo}>
      <div className="trash-panel">
        <div>
          <h2>휴지통</h2>
          <p>이동한 여행은 30일 동안 복구할 수 있습니다.</p>
        </div>
        {status === "loading" ? (
          <p role="status">휴지통을 불러오는 중…</p>
        ) : status === "error" ? (
          <div role="alert">
            <p>{error ?? "휴지통을 불러오지 못했습니다."}</p>
            <button className="primary-button" type="button" onClick={onRetry}>
              다시 시도
            </button>
          </div>
        ) : trips.length === 0 ? (
          <p>휴지통이 비어 있습니다.</p>
        ) : (
          <ul className="trash-list">
            {trips.map((trip) => {
              const purge = purgeState(trip.purgeAfter, now);
              const descriptionId = `trash-purge-${trip.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
              return (
                <li key={trip.id}>
                  <div>
                    <strong>{trip.title}</strong>
                    <p>{trip.destination}</p>
                    <p id={descriptionId}>{purge.label}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={submitting || purge.expired}
                    aria-describedby={purge.expired ? descriptionId : undefined}
                    aria-label={`${trip.title} 복구`}
                    onClick={() => void onRestore(trip)}
                  >
                    복구
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {mutationError ? (
          <p className="form-status" role="alert">{mutationError}</p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
