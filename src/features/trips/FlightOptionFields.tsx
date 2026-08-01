import { useState, type Dispatch } from "react";
import {
  Selector,
  type SelectorOptionType,
} from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
  airlineOptions,
  airportOptions,
  findAirlineByCode,
  findAirlineOption,
  findAirportByIata,
  findAirportOption,
  flightTimeZones,
} from "./flightOptions";

const manualValue = "__manual__";

const airlineSelectorOptions: SelectorOptionType[] = [
  { value: manualValue, label: "목록에 없음 · 직접 입력" },
  { type: "divider" },
  ...airlineOptions.map((airline) => ({
    value: airline.code,
    label: `${airline.code} · ${airline.name} · ${airline.aliases[0]}`,
  })),
];

const airportSelectorOptions: SelectorOptionType[] = [
  { value: manualValue, label: "목록에 없음 · 직접 입력" },
  { type: "divider" },
  ...airportOptions.map((airport) => ({
    value: airport.iata,
    label: `${airport.iata} · ${airport.name} · ${airport.city}`,
  })),
];

const timeZoneSelectorOptions = flightTimeZones.map((timeZone) => ({
  value: timeZone,
  label: timeZone,
}));

export function AirlineField({
  value,
  onChange,
}: {
  value: string;
  onChange: Dispatch<string>;
}) {
  const matched = findAirlineOption(value);
  const [isManual, setIsManual] = useState(Boolean(value && !matched));

  function selectAirline(code: string) {
    if (code === manualValue) {
      setIsManual(true);
      onChange("");
      return;
    }
    setIsManual(false);
    onChange(findAirlineByCode(code)?.name ?? "");
  }

  return (
    <section className="trip-form__option-field">
      <Selector
        label="항공사"
        options={airlineSelectorOptions}
        value={isManual ? manualValue : matched?.code ?? ""}
        onChange={(code) => selectAirline(code ?? "")}
        hasSearch
        searchPlaceholder="항공사명 또는 코드 검색"
        placeholder="항공사를 선택하세요"
        description={matched ? `${matched.code} · ${matched.aliases[0]}` : "항공사명 또는 코드로 검색"}
      />
      {isManual ? (
        <TextInput
          label="항공사 직접 입력"
          value={value}
          onChange={onChange}
          placeholder="항공사 이름"
        />
      ) : null}
    </section>
  );
}

export interface AirportFieldValue {
  name: string;
  iataCode: string;
  timeZone: string;
}

export function AirportField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: AirportFieldValue;
  onChange: Dispatch<AirportFieldValue>;
}) {
  const matched = findAirportOption(value.iataCode || value.name);
  const [isManual, setIsManual] = useState(Boolean(value.name && !matched));

  function selectAirport(iata: string) {
    if (iata === manualValue) {
      setIsManual(true);
      onChange({ name: "", iataCode: "", timeZone: "" });
      return;
    }
    const airport = findAirportByIata(iata);
    if (!airport) return;
    setIsManual(false);
    onChange({
      name: airport.name,
      iataCode: airport.iata,
      timeZone: airport.timeZone,
    });
  }

  return (
    <section className="trip-form__airport-fields">
      <Selector
        label={label}
        options={airportSelectorOptions}
        value={isManual ? manualValue : matched?.iata ?? ""}
        onChange={(iata) => selectAirport(iata ?? "")}
        hasSearch
        searchPlaceholder="공항명·도시·IATA 코드 검색"
        placeholder="공항을 선택하세요"
        description={matched
          ? `${matched.iata} · ${matched.timeZone} 자동 적용`
          : "공항명·도시·IATA 코드로 검색"}
      />
      {isManual ? (
        <>
          <TextInput
            label={`${label} 직접 입력`}
            value={value.name}
            onChange={(name) => onChange({ ...value, name, iataCode: "" })}
            placeholder="공항 이름"
          />
          <Selector
            label="현지 시간대"
            options={timeZoneSelectorOptions}
            value={value.timeZone}
            onChange={(timeZone) => onChange({ ...value, timeZone: timeZone ?? "" })}
            hasSearch
            searchPlaceholder="도시 또는 시간대 검색"
            placeholder="시간대를 선택하세요"
            description="직접 입력한 공항의 현지 시간대"
          />
        </>
      ) : null}
    </section>
  );
}
