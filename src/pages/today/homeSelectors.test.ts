import { describe, expect, it } from "vitest";
import type { Booking, CheckItem, ScheduleItem } from "../../shared/entities";
import {
  expenseReminderKey,
  selectNextSchedule,
  selectUrgentGaps,
  shouldShowExpenseReminder,
} from "./homeSelectors";

const base = {
  id: "item",
  tripId: "trip",
  version: 1,
  updatedAt: "2026-09-01T00:00:00Z",
  updatedBy: "owner",
};

describe("Today home selectors", () => {
  it("caps urgent preparation gaps at three in product priority order", () => {
    const bookings: Booking[] = [{
      ...base,
      id: "required-tour",
      placeId: null,
      bookingType: "tour",
      provider: "Harbour Tour",
      startsAt: "2026-09-12T10:00:00+10:00",
      endsAt: null,
      reservationCode: null,
      paymentStatus: "unpaid",
      externalUrl: null,
      documentUrl: null,
      memo: "",
      isFixed: true,
      isRequired: true,
    }];
    const checkItems: CheckItem[] = [{
      ...base,
      id: "passport",
      phase: "pretrip",
      category: "essential",
      scope: "shared",
      ownerMemberId: null,
      assigneeMemberId: "owner",
      title: "여권",
      quantity: 1,
      memo: "",
      requirementKind: "passport",
      isDone: false,
      position: 1,
    }];

    expect(selectUrgentGaps({
      hasOutboundFlight: false,
      hasReturnFlight: true,
      bookings,
      checkItems,
    }).map((gap) => gap.kind)).toEqual([
      "flight",
      "lodging",
      "required-booking",
    ]);
  });

  it("returns the next three unfinished future schedule items", () => {
    const items: ScheduleItem[] = [0, 1, 2, 3, 4].map((index) => ({
      ...base,
      id: `schedule-${index}`,
      tripDayId: "day",
      placeId: null,
      bookingId: null,
      title: `일정 ${index}`,
      startsAt: `2026-09-10T${String(9 + index).padStart(2, "0")}:00:00+10:00`,
      endsAt: null,
      memo: "",
      travelMode: null,
      travelNote: "",
      position: index,
      isFixed: false,
      isDone: index === 2,
    }));

    expect(selectNextSchedule(
      items,
      new Date("2026-09-09T23:30:00Z"),
    ).map((item) => item.id)).toEqual([
      "schedule-1",
      "schedule-3",
      "schedule-4",
    ]);
  });

  it("shows the local nightly reminder once per trip day", () => {
    expect(shouldShowExpenseReminder({
      experiencePhase: "during",
      localHour: 21,
      dismissed: false,
    })).toBe(true);
    expect(shouldShowExpenseReminder({
      experiencePhase: "during",
      localHour: 21,
      dismissed: true,
    })).toBe(false);
    expect(shouldShowExpenseReminder({
      experiencePhase: "before",
      localHour: 23,
      dismissed: false,
    })).toBe(false);
    expect(expenseReminderKey("trip/서울", "2026-09-10"))
      .toBe("travel-expense-reminder:v1:trip%2F%EC%84%9C%EC%9A%B8:2026-09-10");
  });
});
