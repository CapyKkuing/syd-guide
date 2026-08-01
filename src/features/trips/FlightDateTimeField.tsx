import { useState, type ComponentProps, type Dispatch } from "react";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Selector } from "@astryxdesign/core/Selector";

const hourOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

const minuteOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index * 5).padStart(2, "0"),
  label: String(index * 5).padStart(2, "0"),
}));

const periodOptions = [
  { value: "am", label: "오전" },
  { value: "pm", label: "오후" },
];

type DateInputValue = ComponentProps<typeof DateInput>["value"];

export function FlightDateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: Dispatch<string>;
}) {
  const initial = parseDateTime(value);
  const [date, setDate] = useState(initial.date);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState(initial.period);

  function update(next: Partial<TimeParts>) {
    const parts = { date, hour, minute, period, ...next };
    setDate(parts.date);
    setHour(parts.hour);
    setMinute(parts.minute);
    setPeriod(parts.period);
    onChange(formatDateTime(parts));
  }

  return (
    <section className="trip-form__date-time">
      <DateInput
        label={`${label} 날짜`}
        value={date ? date as DateInputValue : undefined}
        onChange={(nextDate) => update({ date: nextDate ?? "" })}
        placeholder="날짜 선택"
        format="system_date"
      />
      <fieldset className="trip-form__time-selectors">
        <legend>{label} 시간</legend>
        <Selector
          label="시"
          options={hourOptions}
          value={hour}
          onChange={(nextHour) => update({ hour: nextHour ?? "" })}
          placeholder="시"
        />
        <Selector
          label="분"
          options={minuteOptions}
          value={minute}
          onChange={(nextMinute) => update({ minute: nextMinute ?? "" })}
          placeholder="분"
        />
        <Selector
          label="오전/오후"
          options={periodOptions}
          value={period}
          onChange={(nextPeriod) => update({ period: nextPeriod ?? "" })}
          placeholder="구분"
        />
      </fieldset>
    </section>
  );
}

interface TimeParts {
  date: string;
  hour: string;
  minute: string;
  period: string;
}

function parseDateTime(value: string): TimeParts {
  const [date = "", time = ""] = value.split("T");
  const [hourValue = "", minute = ""] = time.split(":");
  if (!hourValue) return { date, hour: "", minute: "", period: "" };
  const hour24 = Number(hourValue);
  return {
    date,
    hour: String(hour24 % 12 || 12),
    minute,
    period: hour24 >= 12 ? "pm" : "am",
  };
}

function formatDateTime({ date, hour, minute, period }: TimeParts): string {
  if (!date || !hour || !minute || !period) return "";
  const hour12 = Number(hour);
  const hour24 = period === "pm"
    ? hour12 % 12 + 12
    : hour12 % 12;
  return `${date}T${String(hour24).padStart(2, "0")}:${minute}`;
}
