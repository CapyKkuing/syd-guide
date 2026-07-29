import { describe, expect, it } from "vitest";
import { deriveExperiencePhase } from "./tripPhase";

describe("deriveExperiencePhase", () => {
  it.each([
    ["2026-10-07T23:59:59.999Z", "before"],
    ["2026-10-08T00:00:00.000Z", "during"],
    ["2026-10-15T04:59:59.999Z", "during"],
    ["2026-10-15T05:00:00.000Z", "after"],
  ] as const)("derives %s as %s", (now, expected) => {
    expect(deriveExperiencePhase({
      journeyStartsAt: "2026-10-08T00:00:00.000Z",
      journeyEndsAt: "2026-10-15T05:00:00.000Z",
      fallbackStatus: "upcoming",
    }, new Date(now))).toBe(expected);
  });

  it.each([
    [null, null, "completed", "after"],
    ["invalid", "2026-10-15T05:00:00.000Z", "active", "during"],
    ["2026-10-15T05:00:00.000Z", "2026-10-08T00:00:00.000Z", "upcoming", "before"],
  ] as const)(
    "falls back for invalid boundaries",
    (journeyStartsAt, journeyEndsAt, fallbackStatus, expected) => {
      expect(deriveExperiencePhase({
        journeyStartsAt,
        journeyEndsAt,
        fallbackStatus,
      }, new Date("2026-10-10T00:00:00.000Z"))).toBe(expected);
    }
  );
});
