import { DateInput } from "@astryxdesign/core/DateInput";
import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from "react";
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
import { DestinationField, TimeZoneField } from "./TripSearchFields";

type DateInputValue = ComponentProps<typeof DateInput>["value"];

type TripFormState = Omit<TripInput, "outboundFlight" | "returnFlight"> & {
  outboundFlight: FlightDraft | null;
  returnFlight: FlightDraft | null;
};

function initialInput(trip?: TripLibrarySummary, initialFocus?: "flights"): TripFormState {
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
      : initialFocus === "flights" ? emptyFlightDraft() : null,
    returnFlight: trip.returnFlight
      ? flightDetailsToDraft(trip.returnFlight)
      : initialFocus === "flights" ? emptyFlightDraft() : null
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
  initialFocus,
  trip,
  submitting,
  requestError,
  onSubmit,
  onClose,
  returnFocusTo
}: {
  initialFocus?: "flights";
  trip?: TripLibrarySummary;
  submitting: boolean;
  requestError?: string;
  // ESLint's base rule does not recognize TypeScript function arguments.
  // eslint-disable-next-line no-unused-vars
  onSubmit: (input: TripInput) => Promise<boolean>;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const [input, setInput] = useState(() => initialInput(trip, initialFocus));
  const [validationError, setValidationError] = useState("");
  const flightSectionRef = useRef<HTMLDivElement>(null);
  const mode = trip ? "edit" : "create";

  useEffect(() => {
    if (initialFocus !== "flights") return;
    requestAnimationFrame(() => flightSectionRef.current?.scrollIntoView({ block: "start" }));
  }, [initialFocus]);

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
        <p>함께 사용할 기본 여행 정보를 입력하세요.</p>
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
        <DestinationField
          destination={input.destination}
          timeZone={input.timeZone}
          onChange={(destination, timeZone) => setInput((current) => ({
            ...current,
            destination,
            timeZone
          }))}
        />
        <div className="trip-form__row">
          <DateInput
            label="시작일"
            value={input.startDate ? input.startDate as DateInputValue : undefined}
            onChange={(startDate) => setInput((current) => ({
              ...current,
              startDate: startDate ?? ""
            }))}
            max={input.endDate ? input.endDate as DateInputValue : undefined}
            placeholder="시작일 선택"
            format="system_date"
            isRequired
          />
          <DateInput
            label="종료일"
            value={input.endDate ? input.endDate as DateInputValue : undefined}
            onChange={(endDate) => setInput((current) => ({
              ...current,
              endDate: endDate ?? ""
            }))}
            min={input.startDate ? input.startDate as DateInputValue : undefined}
            placeholder="종료일 선택"
            format="system_date"
            isRequired
          />
        </div>
        <TimeZoneField
          value={input.timeZone}
          onChange={(timeZone) => setInput((current) => ({ ...current, timeZone }))}
        />
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
        <div ref={flightSectionRef} className="trip-form__section-heading">
          <h3>항공편</h3>
          <p>
            출국편 예정 출발과 귀국편 예정 도착을 여행 시작·종료 기준으로 사용합니다.
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
