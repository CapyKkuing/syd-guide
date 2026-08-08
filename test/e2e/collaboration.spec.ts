import { expect, test } from "@playwright/test";
import {
  createPairedPartner,
  createWorkspace,
  getSnapshot,
  unique
} from "./helpers";

test("owner and partner share schedule, place, booking, checklist, and note edits", async ({
  browser,
  page
}) => {
  test.setTimeout(120_000);
  const workspace = await createWorkspace(page.request, unique("shared-workspace"));
  const partner = await createPairedPartner(browser, page.request, unique("shared-phone"));

  await page.goto(`/trip/${workspace.trip.id}/schedule`);
  await page.getByRole("button", { name: "일정 추가" }).click();
  const scheduleDialog = page.getByRole("dialog", { name: "일정 추가" });
  await scheduleDialog.getByLabel("일정 제목").fill("함께 보는 아침 일정");
  await scheduleDialog.getByLabel("시작 시간").fill("08:30");
  await scheduleDialog.getByRole("button", { name: "저장" }).click();
  await page.getByRole("radio", { name: "전체 일정" }).check();
  await expect(page.getByRole("button", { name: /함께 보는 아침 일정/ }))
    .toBeVisible();

  await page.goto(`/trip/${workspace.trip.id}/map`);
  await page.getByRole("button", { name: "장소 추가" }).click();
  const placeDialog = page.getByRole("dialog", { name: "장소 추가" });
  await placeDialog.getByLabel("장소 이름").fill("함께 고른 카페");
  await placeDialog.getByLabel("분류").selectOption("cafe");
  await placeDialog.getByLabel("주소", { exact: true }).fill("Circular Quay");
  await placeDialog.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("heading", { name: "함께 고른 카페" })).toBeVisible();

  await page.goto(`/trip/${workspace.trip.id}/tools/bookings`);
  await page.getByRole("button", { name: "예약 추가" }).click();
  const bookingDialog = page.getByRole("dialog", { name: "예약 추가" });
  await bookingDialog.getByLabel("예약처").fill("Shared Harbour Hotel");
  await bookingDialog.getByLabel("시작 일시").fill("2026-10-08T15:00");
  await bookingDialog.getByLabel("예약번호").fill("SECRET-BOOKING-13");
  await bookingDialog.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("Shared Harbour Hotel")).toBeVisible();
  await expect(page.getByText("SECRET-BOOKING-13")).toHaveCount(0);
  await page.getByRole("button", { name: "예약 정보 보기" }).click();
  await expect(page.getByRole("button", { name: "예약번호 보기" })).toBeVisible();

  await page.goto(`/trip/${workspace.trip.id}/tools/checklist`);
  await page.getByText("새 체크 항목 추가").click();
  await page.getByLabel("준비물", { exact: true }).fill("공용 충전기");
  await page.getByRole("button", { name: "체크 항목 추가" }).click();
  await expect(page.getByText(/공용 충전기/)).toBeVisible();

  await page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await page.getByLabel("메모 내용").fill("함께 보는 메모");
  await page.getByRole("button", { name: "메모 추가" }).click();
  await expect(page.getByText("함께 보는 메모")).toBeVisible();

  await page.goto(`/trip/${workspace.trip.id}/map`);
  await page.getByRole("button", { name: "상세 보기" }).click();
  const placeDetails = page.getByRole("dialog", { name: "장소 상세" });
  await expect(placeDetails.getByRole("radio", { name: "꼭 가요" })).toHaveCount(0);
  await expect(placeDetails.getByRole("link", { name: "길찾기" })).toBeVisible();

  await partner.page.goto(`/trip/${workspace.trip.id}/schedule`);
  await partner.page.getByRole("radio", { name: "전체 일정" }).check();
  await expect(partner.page.getByRole("button", { name: /함께 보는 아침 일정/ }))
    .toBeVisible();
  await partner.page.goto(`/trip/${workspace.trip.id}/tools/bookings`);
  await expect(partner.page.getByText("Shared Harbour Hotel")).toBeVisible();
  await expect(partner.page.getByText("SECRET-BOOKING-13")).toHaveCount(0);
  await partner.page.goto(`/trip/${workspace.trip.id}/tools/checklist`);
  await expect(partner.page.getByText(/공용 충전기/)).toBeVisible();
  await partner.page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await expect(partner.page.getByText("함께 보는 메모")).toBeVisible();

  await partner.page.goto(`/trip/${workspace.trip.id}/map`);
  await expect(partner.page.getByRole("heading", { name: "함께 고른 카페" })).toBeVisible();
  await partner.page.getByRole("button", { name: "상세 보기" }).click();
  await partner.page.getByRole("button", { name: "장소 수정" }).click();
  const editPlace = partner.page.getByRole("dialog", { name: "장소 수정" });
  await editPlace.getByLabel("장소 이름").fill("파트너가 수정한 카페");
  await editPlace.getByRole("button", { name: "저장" }).click();

  await page.reload();
  await expect(page.getByRole("heading", { name: "파트너가 수정한 카페" }))
    .toBeVisible();

  await page.goto(`/trip/${workspace.trip.id}/tools/checklist`);
  await page.getByText("새 체크 항목 추가").click();
  await page.getByLabel("준비물 범위").selectOption("personal");
  await page.getByLabel("준비물", { exact: true }).fill("owner 전용 준비물");
  await page.getByRole("button", { name: "체크 항목 추가" }).click();
  await page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await page.getByLabel("메모 공개 범위").selectOption("personal");
  await page.getByLabel("메모 내용").fill("owner 전용 메모");
  await page.getByRole("button", { name: "메모 추가" }).click();

  await partner.page.goto(`/trip/${workspace.trip.id}/tools/checklist`);
  await partner.page.reload();
  await expect(partner.page.getByText(/owner 전용 준비물/)).toHaveCount(0);
  await partner.page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await expect(partner.page.getByText("owner 전용 메모")).toHaveCount(0);

  await partner.page.getByLabel("메모 공개 범위").selectOption("personal");
  await partner.page.getByLabel("메모 내용").fill("partner 전용 메모");
  await partner.page.getByRole("button", { name: "메모 추가" }).click();
  await page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await page.reload();
  await expect(page.getByText("partner 전용 메모")).toHaveCount(0);

  const ownerSnapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
  const partnerSnapshot = await getSnapshot(
    partner.context.request,
    workspace.trip.id,
    "session"
  );
  expect(ownerSnapshot.notes.some((note) => note.body === "partner 전용 메모"))
    .toBe(false);
  expect(partnerSnapshot.notes.some((note) => note.body === "owner 전용 메모"))
    .toBe(false);

  await partner.context.close();
});

test("a second online device receives a server-saved note automatically", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  const workspace = await createWorkspace(page.request, unique("online-poll-workspace"));
  const partner = await createPairedPartner(browser, page.request, unique("online-poll-phone"));
  const note = unique("online-poll-note");
  await page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await partner.page.goto(`/trip/${workspace.trip.id}/tools/notes`);

  await page.getByLabel("메모 내용").fill(note);
  await page.getByRole("button", { name: "메모 추가" }).click();
  await expect(page.getByText(note)).toBeVisible();
  await expect(partner.page.getByText(note)).toBeVisible({ timeout: 8_000 });

  const snapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
  expect(snapshot.notes.some((item) => item.body === note)).toBe(true);
  await partner.context.close();
});
