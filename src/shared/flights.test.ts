import { describe, expect, it } from "vitest";
import {
  deriveJourneyBoundaries,
  flightDetailsSchema,
  type FlightDetails,
} from "./flights";

const outbound = {
  airline: "대한항공",
  flightNumber: "KE401",
  departureAirportName: "인천국제공항",
  departureIataCode: "ICN",
  departureTimeZone: "Asia/Seoul",
  scheduledDepartureAt: "2026-09-09T22:00:00+09:00",
  estimatedDepartureAt: "2026-09-09T22:20:00+09:00",
  actualDepartureAt: "2026-09-09T22:30:00+09:00",
  departureTerminal: "2",
  departureGate: "252",
  arrivalAirportName: "시드니 공항",
  arrivalIataCode: "SYD",
  arrivalTimeZone: "Australia/Sydney",
  scheduledArrivalAt: "2026-09-10T09:00:00+10:00",
  estimatedArrivalAt: null,
  actualArrivalAt: null,
  arrivalTerminal: "1",
  arrivalGate: null,
  status: "departed",
} satisfies FlightDetails;

const inbound = {
  ...outbound,
  flightNumber: "KE402",
  departureAirportName: outbound.arrivalAirportName,
  departureIataCode: outbound.arrivalIataCode,
  departureTimeZone: outbound.arrivalTimeZone,
  scheduledDepartureAt: "2026-09-14T09:00:00+10:00",
  estimatedDepartureAt: null,
  actualDepartureAt: null,
  arrivalAirportName: outbound.departureAirportName,
  arrivalIataCode: outbound.departureIataCode,
  arrivalTimeZone: outbound.departureTimeZone,
  scheduledArrivalAt: "2026-09-14T20:00:00+09:00",
  estimatedArrivalAt: "2026-09-14T20:30:00+09:00",
  actualArrivalAt: null,
  status: "delayed",
} satisfies FlightDetails;

describe("flight details", () => {
  it("uses scheduled times for journey boundaries", () => {
    expect(deriveJourneyBoundaries(outbound, inbound)).toEqual({
      journeyStartsAt: "2026-09-09T22:00:00+09:00",
      journeyEndsAt: "2026-09-14T20:00:00+09:00",
    });
  });

  it("does not derive new boundaries from missing or cancelled legs", () => {
    expect(deriveJourneyBoundaries(outbound, null)).toEqual({
      journeyStartsAt: null,
      journeyEndsAt: null,
    });
    expect(deriveJourneyBoundaries(
      outbound,
      { ...inbound, status: "cancelled" }
    )).toEqual({
      journeyStartsAt: null,
      journeyEndsAt: null,
    });
  });

  it("validates airport codes, offsets, and scheduled time order", () => {
    expect(flightDetailsSchema.safeParse(outbound).success).toBe(true);
    expect(flightDetailsSchema.safeParse({
      ...outbound,
      departureIataCode: "IC",
    }).success).toBe(false);
    expect(flightDetailsSchema.safeParse({
      ...outbound,
      scheduledDepartureAt: "2026-09-09T22:00:00",
    }).success).toBe(false);
    expect(flightDetailsSchema.safeParse({
      ...outbound,
      scheduledDepartureAt: "2026-09-10T10:00:00+10:00",
    }).success).toBe(false);
  });
});
