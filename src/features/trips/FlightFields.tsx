import type { Dispatch } from "react";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import type { FlightStatus } from "../../shared/flights";
import type { FlightDraft } from "./flightDraft";
import { FlightDateTimeField } from "./FlightDateTimeField";
import { AirlineField, AirportField } from "./FlightOptionFields";

const statuses: Array<{ value: FlightStatus; label: string }> = [
  { value: "scheduled", label: "예정" },
  { value: "boarding", label: "탑승 중" },
  { value: "delayed", label: "지연" },
  { value: "departed", label: "출발" },
  { value: "arrived", label: "운항 완료" },
  { value: "cancelled", label: "결항" },
  { value: "unknown", label: "확인 필요" },
];

const statusOptions = statuses.map((status) => ({
  value: status.value,
  label: status.label,
}));

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
        <AirlineField
          value={value.airline}
          onChange={(airline) => update("airline", airline)}
        />
        <TextInput
          label="편명"
          value={value.flightNumber}
          onChange={(flightNumber) => update("flightNumber", flightNumber.toUpperCase())}
          placeholder="예: KE401"
        />
      </div>

      <h4>출발</h4>
      <AirportField
        label="출발 공항"
        value={{
          name: value.departureAirportName,
          iataCode: value.departureIataCode,
          timeZone: value.departureTimeZone,
        }}
        onChange={(airport) => onChange({
          ...value,
          departureAirportName: airport.name,
          departureIataCode: airport.iataCode,
          departureTimeZone: airport.timeZone,
        })}
      />
      <FlightDateTimeField
        label="예정 출발"
        value={value.scheduledDepartureAt}
        onChange={(dateTime) => update("scheduledDepartureAt", dateTime)}
      />
      <div className="trip-form__row">
        <TextInput
          label="출발 터미널"
          value={value.departureTerminal}
          onChange={(terminal) => update("departureTerminal", terminal)}
          placeholder="예: T1"
        />
        <TextInput
          label="출발 게이트"
          value={value.departureGate}
          onChange={(gate) => update("departureGate", gate)}
          placeholder="예: 12"
        />
      </div>

      <h4>도착</h4>
      <AirportField
        label="도착 공항"
        value={{
          name: value.arrivalAirportName,
          iataCode: value.arrivalIataCode,
          timeZone: value.arrivalTimeZone,
        }}
        onChange={(airport) => onChange({
          ...value,
          arrivalAirportName: airport.name,
          arrivalIataCode: airport.iataCode,
          arrivalTimeZone: airport.timeZone,
        })}
      />
      <FlightDateTimeField
        label="예정 도착"
        value={value.scheduledArrivalAt}
        onChange={(dateTime) => update("scheduledArrivalAt", dateTime)}
      />
      <div className="trip-form__row">
        <TextInput
          label="도착 터미널"
          value={value.arrivalTerminal}
          onChange={(terminal) => update("arrivalTerminal", terminal)}
          placeholder="예: T1"
        />
        <TextInput
          label="도착 게이트"
          value={value.arrivalGate}
          onChange={(gate) => update("arrivalGate", gate)}
          placeholder="예: 8"
        />
      </div>
      <Selector
        label="운항 상태"
        options={statusOptions}
        value={value.status}
        onChange={(status) => update("status", status as FlightStatus)}
      />
      <div className="trip-form__flight-actions">
        <button className="secondary-button" type="button" onClick={onRemove}>
          {label} 삭제
        </button>
      </div>
    </fieldset>
  );
}
