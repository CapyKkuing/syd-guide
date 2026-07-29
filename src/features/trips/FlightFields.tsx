import type { Dispatch } from "react";
import type { FlightStatus } from "../../shared/flights";
import type { FlightDraft } from "./flightDraft";

const statuses: Array<{ value: FlightStatus; label: string }> = [
  { value: "scheduled", label: "예정" },
  { value: "boarding", label: "탑승 중" },
  { value: "delayed", label: "지연" },
  { value: "departed", label: "출발" },
  { value: "arrived", label: "운항 완료" },
  { value: "cancelled", label: "결항" },
  { value: "unknown", label: "확인 필요" },
];

export function FlightFields({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  value: FlightDraft;
  onChange: Dispatch<FlightDraft>;
  onRemove: () => void;
}) {
  function update<K extends keyof FlightDraft>(field: K, next: FlightDraft[K]) {
    onChange({ ...value, [field]: next });
  }

  return (
    <fieldset className="trip-form__flight">
      <legend>{label}</legend>
      <div className="trip-form__row">
        <label>
          항공사
          <input
            required
            maxLength={160}
            value={value.airline}
            onChange={(event) => update("airline", event.target.value)}
            placeholder="예: 대한항공"
          />
        </label>
        <label>
          편명
          <input
            required
            maxLength={12}
            value={value.flightNumber}
            onChange={(event) => update("flightNumber", event.target.value.toUpperCase())}
            placeholder="예: KE401"
          />
        </label>
      </div>

      <h4>출발</h4>
      <div className="trip-form__row trip-form__row--three">
        <label>
          공항
          <input
            required
            maxLength={160}
            value={value.departureAirportName}
            onChange={(event) => update("departureAirportName", event.target.value)}
            placeholder="예: 인천국제공항"
          />
        </label>
        <label>
          IATA 코드
          <input
            required
            maxLength={3}
            value={value.departureIataCode}
            onChange={(event) => update("departureIataCode", event.target.value.toUpperCase())}
            placeholder="ICN"
          />
        </label>
        <label>
          현지 시간대
          <input
            required
            value={value.departureTimeZone}
            onChange={(event) => update("departureTimeZone", event.target.value)}
            placeholder="Asia/Seoul"
          />
        </label>
      </div>
      <div className="trip-form__row trip-form__row--three">
        <label>
          예정 출발
          <input
            required
            type="datetime-local"
            value={value.scheduledDepartureAt}
            onChange={(event) => update("scheduledDepartureAt", event.target.value)}
          />
        </label>
        <label>
          예상 출발
          <input
            type="datetime-local"
            value={value.estimatedDepartureAt}
            onChange={(event) => update("estimatedDepartureAt", event.target.value)}
          />
        </label>
        <label>
          실제 출발
          <input
            type="datetime-local"
            value={value.actualDepartureAt}
            onChange={(event) => update("actualDepartureAt", event.target.value)}
          />
        </label>
      </div>
      <div className="trip-form__row">
        <label>
          출발 터미널
          <input
            maxLength={80}
            value={value.departureTerminal}
            onChange={(event) => update("departureTerminal", event.target.value)}
          />
        </label>
        <label>
          출발 게이트
          <input
            maxLength={80}
            value={value.departureGate}
            onChange={(event) => update("departureGate", event.target.value)}
          />
        </label>
      </div>

      <h4>도착</h4>
      <div className="trip-form__row trip-form__row--three">
        <label>
          공항
          <input
            required
            maxLength={160}
            value={value.arrivalAirportName}
            onChange={(event) => update("arrivalAirportName", event.target.value)}
            placeholder="예: 시드니 공항"
          />
        </label>
        <label>
          IATA 코드
          <input
            required
            maxLength={3}
            value={value.arrivalIataCode}
            onChange={(event) => update("arrivalIataCode", event.target.value.toUpperCase())}
            placeholder="SYD"
          />
        </label>
        <label>
          현지 시간대
          <input
            required
            value={value.arrivalTimeZone}
            onChange={(event) => update("arrivalTimeZone", event.target.value)}
            placeholder="Australia/Sydney"
          />
        </label>
      </div>
      <div className="trip-form__row trip-form__row--three">
        <label>
          예정 도착
          <input
            required
            type="datetime-local"
            value={value.scheduledArrivalAt}
            onChange={(event) => update("scheduledArrivalAt", event.target.value)}
          />
        </label>
        <label>
          예상 도착
          <input
            type="datetime-local"
            value={value.estimatedArrivalAt}
            onChange={(event) => update("estimatedArrivalAt", event.target.value)}
          />
        </label>
        <label>
          실제 도착
          <input
            type="datetime-local"
            value={value.actualArrivalAt}
            onChange={(event) => update("actualArrivalAt", event.target.value)}
          />
        </label>
      </div>
      <div className="trip-form__row">
        <label>
          도착 터미널
          <input
            maxLength={80}
            value={value.arrivalTerminal}
            onChange={(event) => update("arrivalTerminal", event.target.value)}
          />
        </label>
        <label>
          도착 게이트
          <input
            maxLength={80}
            value={value.arrivalGate}
            onChange={(event) => update("arrivalGate", event.target.value)}
          />
        </label>
      </div>
      <label>
        운항 상태
        <select
          value={value.status}
          onChange={(event) => update("status", event.target.value as FlightStatus)}
        >
          {statuses.map((status) => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </label>
      <div className="trip-form__flight-actions">
        <button className="secondary-button" type="button" onClick={onRemove}>
          {label} 삭제
        </button>
      </div>
    </fieldset>
  );
}
