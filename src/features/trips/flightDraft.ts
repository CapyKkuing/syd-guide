import type { FlightDetails, FlightStatus } from "../../shared/flights";

export interface FlightDraft {
  airline: string;
  flightNumber: string;
  departureAirportName: string;
  departureIataCode: string;
  departureTimeZone: string;
  scheduledDepartureAt: string;
  departureTerminal: string;
  departureGate: string;
  arrivalAirportName: string;
  arrivalIataCode: string;
  arrivalTimeZone: string;
  scheduledArrivalAt: string;
  arrivalTerminal: string;
  arrivalGate: string;
  status: FlightStatus;
}

export function emptyFlightDraft(): FlightDraft {
  return {
    airline: "",
    flightNumber: "",
    departureAirportName: "",
    departureIataCode: "",
    departureTimeZone: "",
    scheduledDepartureAt: "",
    departureTerminal: "",
    departureGate: "",
    arrivalAirportName: "",
    arrivalIataCode: "",
    arrivalTimeZone: "",
    scheduledArrivalAt: "",
    arrivalTerminal: "",
    arrivalGate: "",
    status: "scheduled",
  };
}

export function flightDetailsToDraft(flight: FlightDetails): FlightDraft {
  return {
    airline: flight.airline,
    flightNumber: flight.flightNumber,
    departureAirportName: flight.departureAirportName,
    departureIataCode: flight.departureIataCode,
    departureTimeZone: flight.departureTimeZone,
    scheduledDepartureAt: localDateTime(flight.scheduledDepartureAt),
    departureTerminal: flight.departureTerminal ?? "",
    departureGate: flight.departureGate ?? "",
    arrivalAirportName: flight.arrivalAirportName,
    arrivalIataCode: flight.arrivalIataCode,
    arrivalTimeZone: flight.arrivalTimeZone,
    scheduledArrivalAt: localDateTime(flight.scheduledArrivalAt),
    arrivalTerminal: flight.arrivalTerminal ?? "",
    arrivalGate: flight.arrivalGate ?? "",
    status: flight.status,
  };
}

export function flightDraftToDetails(draft: FlightDraft): FlightDetails {
  return {
    airline: draft.airline.trim(),
    flightNumber: draft.flightNumber.trim().toUpperCase(),
    departureAirportName: draft.departureAirportName.trim(),
    departureIataCode: draft.departureIataCode.trim().toUpperCase(),
    departureTimeZone: draft.departureTimeZone.trim(),
    scheduledDepartureAt: requiredZonedDateTime(
      draft.scheduledDepartureAt,
      draft.departureTimeZone,
      "예정 출발시각"
    ),
    estimatedDepartureAt: null,
    actualDepartureAt: null,
    departureTerminal: optionalText(draft.departureTerminal),
    departureGate: optionalText(draft.departureGate),
    arrivalAirportName: draft.arrivalAirportName.trim(),
    arrivalIataCode: draft.arrivalIataCode.trim().toUpperCase(),
    arrivalTimeZone: draft.arrivalTimeZone.trim(),
    scheduledArrivalAt: requiredZonedDateTime(
      draft.scheduledArrivalAt,
      draft.arrivalTimeZone,
      "예정 도착시각"
    ),
    estimatedArrivalAt: null,
    actualArrivalAt: null,
    arrivalTerminal: optionalText(draft.arrivalTerminal),
    arrivalGate: optionalText(draft.arrivalGate),
    status: draft.status,
  };
}

function localDateTime(value: string): string {
  return value.slice(0, 16);
}

function optionalText(value: string): string | null {
  return value.trim() || null;
}

function requiredZonedDateTime(
  value: string,
  timeZone: string,
  label: string
): string {
  if (!value) throw new Error(`${label}을 입력하세요.`);
  return zonedDateTime(value, timeZone);
}

function zonedDateTime(value: string, timeZone: string): string {
  const [date = "", time = ""] = value.split("T");
  const guess = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(guess)) throw new Error("항공편 시각을 확인해 주세요.");
  const firstOffset = offsetMinutes(new Date(guess), timeZone);
  const instant = new Date(guess - firstOffset * 60_000);
  return `${date}T${time}:00${formatOffset(offsetMinutes(instant, timeZone))}`;
}

function offsetMinutes(date: Date, timeZone: string): number {
  let name: string | undefined;
  try {
    name = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  } catch {
    throw new Error("유효한 공항 시간대를 입력하세요.");
  }
  if (!name || name === "GMT") return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name);
  if (!match) throw new Error("공항 시간대를 적용하지 못했습니다.");
  return (match[1] === "+" ? 1 : -1)
    * (Number(match[2]) * 60 + Number(match[3]));
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
