import { BottomSheet } from "../../components/BottomSheet";
import type { ReactNode } from "react";
import {
  tripLibraryErrorMessage,
  type TripInput,
  type TripLibrarySummary
} from "./api";
import { TrashPanel } from "./TrashPanel";
import { TripForm } from "./TripForm";
import type { useTripLibrary } from "./useTripLibrary";

export type LibraryDialogState =
  | { kind: "create"; opener: HTMLElement | null }
  | { kind: "edit"; trip: TripLibrarySummary; opener: HTMLElement | null }
  | { kind: "trash"; opener: HTMLElement | null }
  | { kind: "devices"; opener: HTMLElement | null }
  | {
      kind: "confirm-trash";
      trip: TripLibrarySummary;
      opener: HTMLElement | null;
    }
  | null;

export function LibraryDialogs({
  dialog,
  library,
  deviceManagement,
  initialEditFocus,
  now,
  onClose
}: {
  dialog: LibraryDialogState;
  library: ReturnType<typeof useTripLibrary>;
  deviceManagement: ReactNode;
  initialEditFocus?: "flights";
  now: Date;
  onClose: () => void;
}) {
  const guardedClose = library.isMutating ? () => {} : onClose;
  const mutationMessage = library.mutationError
    ? tripLibraryErrorMessage(library.mutationError)
    : undefined;

  if (dialog?.kind === "create" || dialog?.kind === "edit") {
    return (
      <TripForm
        key={dialog.kind === "edit" ? dialog.trip.id : "create"}
        initialFocus={dialog.kind === "edit" ? initialEditFocus : undefined}
        trip={dialog.kind === "edit" ? dialog.trip : undefined}
        submitting={library.isMutating}
        requestError={mutationMessage}
        returnFocusTo={dialog.opener}
        onClose={guardedClose}
        onSubmit={async (input: TripInput) => {
          const succeeded = dialog.kind === "edit"
            ? await library.update(dialog.trip, input)
            : await library.create(input);
          if (succeeded) onClose();
          return succeeded;
        }}
      />
    );
  }

  if (dialog?.kind === "confirm-trash") {
    return (
      <BottomSheet
        ariaLabel="여행 휴지통 이동 확인"
        onClose={guardedClose}
        returnFocusTo={dialog.opener}
      >
        <div className="trip-delete-confirmation">
          <h2>휴지통으로 이동할까요?</h2>
          <p>
            <strong>{dialog.trip.title}</strong>을 휴지통으로 이동합니다.
            30일 동안 복구할 수 있습니다.
          </p>
          {mutationMessage ? (
            <p className="form-status" role="alert">
              {mutationMessage}
            </p>
          ) : null}
          <div className="trip-form__actions">
            <button
              type="button"
              className="secondary-button"
              disabled={library.isMutating}
              onClick={guardedClose}
            >
              취소
            </button>
            <button
              type="button"
              className="primary-button trip-delete-button"
              disabled={library.isMutating}
              onClick={async () => {
                if (await library.moveToTrash(dialog.trip)) onClose();
              }}
            >
              {library.isMutating ? "이동 중…" : "휴지통으로 이동"}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  if (dialog?.kind === "trash") {
    return (
      <TrashPanel
        status={library.trash.status}
        trips={library.trash.trips}
        error={library.trash.status === "error" ? library.trash.error.message : undefined}
        mutationError={mutationMessage}
        now={now}
        submitting={library.isMutating}
        onRetry={library.loadTrash}
        onRestore={library.restore}
        onClose={guardedClose}
        returnFocusTo={dialog.opener}
      />
    );
  }

  if (dialog?.kind === "devices") {
    return (
      <BottomSheet
        ariaLabel="연결 기기 관리"
        onClose={onClose}
        returnFocusTo={dialog.opener}
      >
        <div className="library-device-management">
          <div>
            <h2>연결 기기</h2>
            <p>현재 여행과 관계없이 이 계정에 연결된 기기를 관리합니다.</p>
          </div>
          {deviceManagement}
        </div>
      </BottomSheet>
    );
  }

  return null;
}
