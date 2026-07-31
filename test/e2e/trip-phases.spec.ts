import { expect, test } from "@playwright/test";
import type { FlightDetails } from "../../src/shared/flights";
import {
  createWorkspace,
  flushOutbox,
  getSnapshot,
  mutate,
  unique,
} from "./helpers";

test("journey boundaries render the approved before, during, and after homes", async ({
  page,
}) => {
  const before = await createWorkspace(
    page.request,
    unique("phase-before"),
    "owner",
    phaseOptions("before"),
  );
  await page.goto(`/trip/${before.trip.id}/today`);
  await expect(page.getByText("여행 전", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /여행 대표 사진/ })).toBeVisible();
  const urgentCount = await page.locator(".urgent-gap-list > li").count();
  expect(urgentCount).toBeGreaterThan(0);
  expect(urgentCount).toBeLessThanOrEqual(3);
  await expect(page.getByRole("heading", { name: "날씨" })).toHaveCount(0);

  const during = await createWorkspace(
    page.request,
    unique("phase-during"),
    "owner",
    phaseOptions("during"),
  );
  await seedNextSchedule(page.request, during.trip.id, during.tripDayId);
  await page.goto(`/trip/${during.trip.id}/today`);
  await expect(page.getByText("여행 중", { exact: true })).toBeVisible();
  await expect(page.locator(".today-live-hero")).toHaveCount(1);
  await expect(page.locator(".today-live-next")).toHaveCount(1);
  await expect(page.locator(".today-live-quick-row .astryx-card")).toHaveCount(2);
  await expect(page.locator(".today-live-schedule")).toHaveCount(1);
  await expect(page.getByText("다음 일정 2")).toBeVisible();
  await expect(page.getByText("다음 일정 4")).toBeVisible();

  const after = await createWorkspace(
    page.request,
    unique("phase-after"),
    "owner",
    phaseOptions("after"),
  );
  await mutate(page.request, after.trip.id, {
    entity: "expense",
    action: "create",
    entityId: unique("settled-expense"),
    baseVersion: null,
    payload: {
      phase: "travel",
      category: "food",
      title: "정산이 끝난 저녁",
      amountMinor: 8_500,
      currency: "AUD",
      spentOn: new Date().toISOString().slice(0, 10),
      paidByMemberId: "owner",
      expenseScope: "shared",
      personalForMemberId: null,
      paymentMethod: "card",
      isSettled: true,
      memo: "",
    },
  });
  await page.goto(`/trip/${after.trip.id}/today`);
  await expect(page.getByText("귀국 후", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "여행 기록 보기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "다시 여행 보기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "정산 완료" })).toHaveCount(0);
  await expect(page.getByText("정산이 끝난 저녁")).toBeVisible();
});

test("personal expenses save their payment method without a settlement control", async ({ page }) => {
  const before = await createWorkspace(
    page.request,
    unique("expense-scope"),
    "owner",
    phaseOptions("before"),
  );

  await page.goto(`/trip/${before.trip.id}/today`);
  await page.getByRole("button", { name: "준비 비용 추가" }).click();
  await page.getByLabel("항목").fill("개인 커피");
  await page.getByLabel("금액").fill("5");
  await page.getByLabel("개인").check();
  await page.getByLabel("개인 비용 대상").selectOption("owner");
  await page.getByLabel("현금").check();

  await expect(page.getByLabel("정산 완료")).toHaveCount(0);
  await page.getByRole("button", { name: "저장" }).click();
  await flushOutbox(page, before.trip.id);
  await expect.poll(async () => {
    const snapshot = await getSnapshot(page.request, before.trip.id, "owner");
    return snapshot.expenses.some((expense) => expense.title === "개인 커피");
  }).toBe(true);
  await page.reload();
  await expect(page.getByText("개인 커피")).toBeVisible();
  await expect(page.getByText(/개인 · 현금/)).toBeVisible();
});

test("personal items paid by the other traveler create a settlement", async ({ page }) => {
  const after = await createWorkspace(
    page.request,
    unique("delegated-personal"),
    "owner",
    phaseOptions("after"),
  );
  const expenseId = unique("partner-personal-item");
  await mutate(page.request, after.trip.id, {
    entity: "expense",
    action: "create",
    entityId: expenseId,
    baseVersion: null,
    payload: {
      phase: "travel",
      category: "shopping",
      title: "파트너 개인 물품",
      amountMinor: 2_000,
      currency: "AUD",
      spentOn: new Date().toISOString().slice(0, 10),
      paidByMemberId: "owner",
      expenseScope: "personal",
      personalForMemberId: "partner",
      paymentMethod: "card",
      isSettled: false,
      memo: "",
    },
  });

  await page.goto(`/trip/${after.trip.id}/today`);
  await expect(page.getByRole("heading", { name: "정산하기" })).toBeVisible();
  await expect(page.getByText("대신 결제한 개인 비용", { exact: true })).toBeVisible();
  await expect(page.locator(".settlement-panel__summary")).toContainText("대신 결제한 개인 비용");
  await expect(page.locator(".settlement-panel__currency")).toContainText("20.00");
  await page.getByRole("button", { name: "송금 완료로 표시" }).click();
  await flushOutbox(page, after.trip.id);
  await expect(page.locator(".settlement-panel")).toHaveCount(0);

  await expect.poll(async () => {
    const snapshot = await getSnapshot(page.request, after.trip.id, "owner");
    return snapshot.expenses.find((expense) => expense.id === expenseId)?.isSettled;
  }).toBe(true);
});

function phaseOptions(phase: "before" | "during" | "after") {
  const boundaries = {
    before: [1, 4],
    during: [-1, 2],
    after: [-4, -1],
  }[phase];
  return {
    outboundFlight: flight(
      "KE401",
      "ICN",
      "SYD",
      dateAt(boundaries[0]),
      dateAt(boundaries[0] + 0.5),
    ),
    returnFlight: flight(
      "KE402",
      "SYD",
      "ICN",
      dateAt(boundaries[1] - 0.5),
      dateAt(boundaries[1]),
    ),
    status: "upcoming" as const,
  };
}

function flight(
  flightNumber: string,
  departureIataCode: string,
  arrivalIataCode: string,
  scheduledDepartureAt: string,
  scheduledArrivalAt: string,
): FlightDetails {
  const departingKorea = departureIataCode === "ICN";
  return {
    airline: "Korean Air",
    flightNumber,
    departureAirportName: departingKorea ? "Incheon" : "Sydney",
    departureIataCode,
    departureTimeZone: departingKorea ? "Asia/Seoul" : "Australia/Sydney",
    scheduledDepartureAt,
    estimatedDepartureAt: null,
    actualDepartureAt: null,
    departureTerminal: "1",
    departureGate: null,
    arrivalAirportName: departingKorea ? "Sydney" : "Incheon",
    arrivalIataCode,
    arrivalTimeZone: departingKorea ? "Australia/Sydney" : "Asia/Seoul",
    scheduledArrivalAt,
    estimatedArrivalAt: null,
    actualArrivalAt: null,
    arrivalTerminal: "1",
    arrivalGate: null,
    status: "scheduled",
  };
}

function dateAt(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1_000).toISOString();
}

async function seedNextSchedule(
  request: Parameters<typeof mutate>[0],
  tripId: string,
  tripDayId: string,
): Promise<void> {
  for (let index = 1; index <= 4; index += 1) {
    const startsAt = dateAt(index);
    await mutate(request, tripId, {
      entity: "schedule_item",
      action: "create",
      entityId: unique(`phase-schedule-${index}`),
      baseVersion: null,
      payload: {
        tripDayId,
        placeId: null,
        bookingId: null,
        title: `다음 일정 ${index}`,
        startsAt,
        endsAt: new Date(Date.parse(startsAt) + 30 * 60 * 1_000).toISOString(),
        memo: "",
        travelMode: "walk",
        travelNote: "",
        position: index,
        isFixed: false,
        isDone: index === 1,
      },
    });
  }
}
