import type { ExperiencePhase } from "../../domain/tripPhase";
import type { Booking, CheckItem } from "../../shared/entities";

export interface UrgentGap {
  kind: "flight" | "lodging" | "required-booking" | "passport" | "essential-check-item";
  label: string;
  description: string;
  target: "trip" | "bookings" | "checklist";
}

export function selectUrgentGaps({
  hasOutboundFlight,
  hasReturnFlight,
  bookings,
  checkItems,
}: {
  hasOutboundFlight: boolean;
  hasReturnFlight: boolean;
  bookings: Booking[];
  checkItems: CheckItem[];
}): UrgentGap[] {
  const gaps: UrgentGap[] = [];
  if (!hasOutboundFlight || !hasReturnFlight) {
    gaps.push({
      kind: "flight",
      label: "항공편 확인",
      description: !hasOutboundFlight && !hasReturnFlight
        ? "출국편과 귀국편을 입력해 주세요."
        : `${hasOutboundFlight ? "귀국편" : "출국편"}을 입력해 주세요.`,
      target: "trip",
    });
  }
  if (!bookings.some((booking) => booking.bookingType === "lodging")) {
    gaps.push({
      kind: "lodging",
      label: "숙소 예약",
      description: "숙소 예약 정보를 추가해 주세요.",
      target: "bookings",
    });
  }
  const requiredBooking = bookings.find((booking) =>
    booking.isRequired
    && booking.paymentStatus !== "paid"
    && booking.paymentStatus !== "refunded"
  );
  if (requiredBooking) {
    gaps.push({
      kind: "required-booking",
      label: "필수 예약 결제",
      description: `${requiredBooking.provider} 결제 상태를 확인해 주세요.`,
      target: "bookings",
    });
  }
  const passport = checkItems.find((item) => item.requirementKind === "passport");
  if (!passport?.isDone) {
    gaps.push({
      kind: "passport",
      label: "여권 확인",
      description: passport ? "여권 준비 완료 여부를 확인해 주세요." : "여권 항목을 체크리스트에 추가해 주세요.",
      target: "checklist",
    });
  }
  const essential = checkItems.find((item) =>
    item.requirementKind === "essential" && !item.isDone
  );
  if (essential) {
    gaps.push({
      kind: "essential-check-item",
      label: essential.title,
      description: "필수 준비물 완료 여부를 확인해 주세요.",
      target: "checklist",
    });
  }
  return gaps.slice(0, 3);
}

export function selectNextSchedule<T extends {
  startsAt: string | null;
  isDone: boolean;
}>(items: T[], now: Date): T[] {
  return items
    .filter((item) =>
      !item.isDone
      && item.startsAt !== null
      && new Date(item.startsAt).getTime() >= now.getTime()
    )
    .sort((left, right) => (left.startsAt ?? "").localeCompare(right.startsAt ?? ""))
    .slice(0, 3);
}

export function shouldShowExpenseReminder({
  experiencePhase,
  localHour,
  dismissed,
}: {
  experiencePhase: ExperiencePhase;
  localHour: number;
  dismissed: boolean;
}): boolean {
  return experiencePhase === "during" && localHour >= 21 && !dismissed;
}

export function expenseReminderKey(tripId: string, localDate: string): string {
  return `travel-expense-reminder:v1:${encodeURIComponent(tripId)}:${localDate}`;
}
