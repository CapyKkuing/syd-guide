import { z } from "zod";

export const flightStatusSchema = z.enum([
  "scheduled",
  "boarding",
  "delayed",
  "departed",
  "arrived",
  "cancelled",
  "unknown",
]);

const timestamp = z.iso.datetime({ offset: true });
const optionalText = z.string().trim().max(80).nullable();

export const flightDetailsSchema = z.object({
  airline: z.string().trim().min(1).max(160),
  flightNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9 -]{1,11}$/),
  departureAirportName: z.string().trim().min(1).max(160),
  departureIataCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  departureTimeZone: z.string().refine(isValidTimeZone),
  scheduledDepartureAt: timestamp,
  estimatedDepartureAt: timestamp.nullable(),
  actualDepartureAt: timestamp.nullable(),
  departureTerminal: optionalText,
  departureGate: optionalText,
  arrivalAirportName: z.string().trim().min(1).max(160),
  arrivalIataCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  arrivalTimeZone: z.string().refine(isValidTimeZone),
  scheduledArrivalAt: timestamp,
  estimatedArrivalAt: timestamp.nullable(),
  actualArrivalAt: timestamp.nullable(),
  arrivalTerminal: optionalText,
  arrivalGate: optionalText,
  status: flightStatusSchema,
}).superRefine((flight, context) => {
  if (Date.parse(effectiveDepartureAt(flight)) >= Date.parse(effectiveArrivalAt(flight))) {
    context.addIssue({
      code: "custom",
      path: ["scheduledArrivalAt"],
      message: "도착시각은 출발시각보다 늦어야 합니다.",
    });
  }
});

export type FlightStatus = z.infer<typeof flightStatusSchema>;
export type FlightDetails = z.infer<typeof flightDetailsSchema>;

export function effectiveDepartureAt(flight: FlightDetails): string {
  return flight.actualDepartureAt
    ?? flight.estimatedDepartureAt
    ?? flight.scheduledDepartureAt;
}

export function effectiveArrivalAt(flight: FlightDetails): string {
  return flight.actualArrivalAt
    ?? flight.estimatedArrivalAt
    ?? flight.scheduledArrivalAt;
}

export function deriveJourneyBoundaries(
  outboundFlight: FlightDetails | null,
  returnFlight: FlightDetails | null
): { journeyStartsAt: string | null; journeyEndsAt: string | null } {
  if (
    !outboundFlight
    || !returnFlight
    || outboundFlight.status === "cancelled"
    || returnFlight.status === "cancelled"
  ) {
    return { journeyStartsAt: null, journeyEndsAt: null };
  }
  return {
    journeyStartsAt: effectiveDepartureAt(outboundFlight),
    journeyEndsAt: effectiveArrivalAt(returnFlight),
  };
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
