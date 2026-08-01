import { describe, expect, it } from "vitest";
import type { FlightDetails } from "../../shared/flights";
import { flightDetailsToDraft, flightDraftToDetails } from "./flightDraft";

const savedFlight: FlightDetails = {
  airline: "대한항공",
  flightNumber: "KE401",
  departureAirportName: "인천국제공항",
  departureIataCode: "ICN",
  departureTimeZone: "Asia/Seoul",
  scheduledDepartureAt: "2026-09-09T22:00:00+09:00",
  estimatedDepartureAt: "2026-09-09T22:10:00+09:00",
  actualDepartureAt: "2026-09-09T22:20:00+09:00",
  departureTerminal: "2",
  departureGate: "252",
  arrivalAirportName: "시드니 킹스포드 스미스 국제공항",
  arrivalIataCode: "SYD",
  arrivalTimeZone: "Australia/Sydney",
  scheduledArrivalAt: "2026-09-10T09:00:00+10:00",
  estimatedArrivalAt: "2026-09-10T09:10:00+10:00",
  actualArrivalAt: null,
  arrivalTerminal: "1",
  arrivalGate: null,
  status: "scheduled",
};

describe("flight draft conversion", () => {
  it("reopens scheduled values and clears obsolete estimated and actual times", () => {
    const reopened = flightDetailsToDraft(savedFlight);

    expect(reopened.flightNumber).toBe("KE401");
    expect(reopened.scheduledDepartureAt).toBe("2026-09-09T22:00");
    expect(reopened).not.toHaveProperty("estimatedDepartureAt");
    expect(reopened).not.toHaveProperty("actualArrivalAt");
    expect(flightDraftToDetails(reopened)).toEqual({
      ...savedFlight,
      estimatedDepartureAt: null,
      actualDepartureAt: null,
      estimatedArrivalAt: null,
      actualArrivalAt: null,
    });
  });
});
