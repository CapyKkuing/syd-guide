import type { TripStatus } from "../shared/entities";

export type ExperiencePhase = "before" | "during" | "after";

export interface JourneyBoundary {
  journeyStartsAt: string | null;
  journeyEndsAt: string | null;
  fallbackStatus: TripStatus;
}

const fallbackPhases: Record<TripStatus, ExperiencePhase> = {
  upcoming: "before",
  active: "during",
  completed: "after",
};

export function deriveExperiencePhase(
  boundary: JourneyBoundary,
  now: Date
): ExperiencePhase {
  const startsAt = boundary.journeyStartsAt
    ? Date.parse(boundary.journeyStartsAt)
    : Number.NaN;
  const endsAt = boundary.journeyEndsAt
    ? Date.parse(boundary.journeyEndsAt)
    : Number.NaN;
  const current = now.getTime();

  if (
    !Number.isFinite(startsAt)
    || !Number.isFinite(endsAt)
    || !Number.isFinite(current)
    || startsAt >= endsAt
  ) {
    return fallbackPhases[boundary.fallbackStatus];
  }
  if (current < startsAt) return "before";
  return current < endsAt ? "during" : "after";
}
