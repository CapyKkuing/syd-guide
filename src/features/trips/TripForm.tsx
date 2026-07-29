import { useState, type FormEvent } from "react";
import { BottomSheet } from "../../components/BottomSheet";
import {
  tripInputSchema,
  type TripInput,
  type TripLibrarySummary
} from "./api";
import {
  FlightFields,
} from "./FlightFields";
import {
  emptyFlightDraft,
  flightDetailsToDraft,
  flightDraftToDetails,
  type FlightDraft
} from "./flightDraft";

const destinationPresets: Record<string, string> = {
  Sydney: "Australia/Sydney",
  Tokyo: "Asia/Tokyo",
  Seoul: "Asia/Seoul",
  London: "Europe/London",
  Paris: "Europe/Paris",
  "New York": "America/New_York"
};

type TripFormState = Omit<TripInput, "outboundFlight" | "returnFlight"> & {
  outboundFlight: FlightDraft | null;
  returnFlight: FlightDraft | null;
};

function initialInput(trip?: TripLibrarySummary): TripFormState {
  return trip ? {
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    timeZone: trip.timeZone,
    status: trip.status,
    coverImageUrl: trip.coverImageUrl,
    outboundFlight: trip.outboundFlight
      ? flightDetailsToDraft(trip.outboundFlight)
      : null,
    returnFlight: trip.returnFlight
      ? flightDetailsToDraft(trip.returnFlight)
      : null
  } : {
    title: "",
    destination: "",
    startDate: "",
    endDate: "",
    timeZone: "",
    status: "upcoming",
    coverImageUrl: null,
    outboundFlight: null,
    returnFlight: null
  };
}

export function TripForm({
  trip,
  submitting,
  requestError,
  onSubmit,
  onClose,
  returnFocusTo
}: {
  trip?: TripLibrarySummary;
  submitting: boolean;
  requestError?: string;
  // ESLint's base rule does not recognize TypeScript function arguments.
  // eslint-disable-next-line no-unused-vars
  onSubmit: (input: TripInput) => Promise<boolean>;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const [input, setInput] = useState(() => initialInput(trip));
  const [validationError, setValidationError] = useState("");
  const mode = trip ? "edit" : "create";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    let candidate: TripInput;
    try {
      candidate = {
        ...input,
        outboundFlight: input.outboundFlight
          ? flightDraftToDetails(input.outboundFlight)
          : null,
        returnFlight: input.returnFlight
          ? flightDraftToDetails(input.returnFlight)
          : null
      };
    } catch (caught) {
      setValidationError(
        caught instanceof Error ? caught.message : "항공편 입력값을 확인해 주세요."
      );
      return;
    }
    const parsed = tripInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
      return;
    }
    setValidationError("");
    await onSubmit(parsed.data);
  }

  return (
    <BottomSheet
      ariaLabel={mode === "create" ? "새 여행 만들기" : "여행 수정"}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
    >
      <div className="trip-form__heading">
        <h2>{mode === "create" ? "새 여행 만들기" : "여행 수정"}</h2>
        <p>둘이 함께 사용할 기본 여행 정보를 입력하세요.</p>
      </div>
      <form className="trip-form" onSubmit={submit}>
        <label>
          여행 제목
          <input
            required
            maxLength={80}
            value={input.title}
            onChange={(event) => setInput((current) => ({
              ...current,
              title: event.target.value
            }))}
          />
        </label>
        <label>
          여행지
          <input
            required
            maxLength={120}
            list="trip-destinations"
            value={input.destination}
            onChange={(event) => {
              const destination = event.target.value;
              setInput((current) => ({
                ...current,
                destination,
                timeZone: destinationPresets[destination] ?? current.timeZone
              }));
            }}
          />
          <datalist id="trip-destinations">
            {Object.keys(destinationPresets).map((destination) => (
              <option key={destination} value={destination} />
            ))}
          </datalist>
        </label>
        <div className="trip-form__row">
          <label>
            시작일
            <input
              required
              type="date"
              value={input.startDate}
              onChange={(event) => setInput((current) => ({
                ...current,
                startDate: event.target.value
              }))}
            />
          </label>
          <label>
            종료일
            <input
              required
              type="date"
              value={input.endDate}
              onChange={(event) => setInput((current) => ({
                ...current,
                endDate: event.target.value
              }))}
            />
          </label>
        </div>
        <label>
          시간대
          <input
            required
            value={input.timeZone}
            onChange={(event) => setInput((current) => ({
              ...current,
              timeZone: event.target.value
            }))}
            placeholder="예: Australia/Sydney"
          />
        </label>
        <label>
          상태
          <select
            value={input.status}
            onChange={(event) => setInput((current) => ({
              ...current,
              status: event.target.value as TripInput["status"]
            }))}
          >
            <option value="upcoming">예정</option>
            <option value="active">여행 중</option>
            <option value="completed">완료</option>
          </select>
        </label>
        <div className="trip-form__section-heading">
          <h3>항공편</h3>
          <p>
            실제 시각이 있으면 실제, 없으면 예상, 예정 순서로 여행 시작·종료를 계산합니다.
          </p>
        </div>
        {input.outboundFlight ? (
          <FlightFields
            label="출국편"
            value={input.outboundFlight}
            onChange={(outboundFlight) => setInput((current) => ({
              ...current,
              outboundFlight
            }))}
            onRemove={() => setInput((current) => ({
              ...current,
              outboundFlight: null
            }))}
          />
        ) : (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setInput((current) => ({
              ...current,
              outboundFlight: emptyFlightDraft()
            }))}
          >
            출국편 입력
          </button>
        )}
        {input.returnFlight ? (
          <FlightFields
            label="귀국편"
            value={input.returnFlight}
            onChange={(returnFlight) => setInput((current) => ({
              ...current,
              returnFlight
            }))}
            onRemove={() => setInput((current) => ({
              ...current,
              returnFlight: null
            }))}
          />
        ) : (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setInput((current) => ({
              ...current,
              returnFlight: emptyFlightDraft()
            }))}
          >
            귀국편 입력
          </button>
        )}
        <label>
          대표 이미지 주소
          <input
            type="text"
            inputMode="url"
            value={input.coverImageUrl ?? ""}
            onChange={(event) => setInput((current) => ({
              ...current,
              coverImageUrl: event.target.value || null
            }))}
            placeholder="https://… 또는 /images/…"
          />
        </label>
        {validationError || requestError ? (
          <p className="form-status" role="alert">
            {requestError ?? validationError}
          </p>
        ) : null}
        <div className="trip-form__actions">
          <button
            type="button"
            className="secondary-button"
            disabled={submitting}
            onClick={onClose}
          >
            취소
          </button>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting
              ? "저장 중…"
              : mode === "create" ? "여행 만들기" : "변경 저장"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
