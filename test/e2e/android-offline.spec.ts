import { expect, test } from "@playwright/test";
import {
  createWorkspace,
  getSnapshot,
  mutate,
  outboxCount,
  unique,
} from "./helpers";

test("schedule order and travel note survive an offline cold start and reconnect without conflicts", async ({
  context,
  page
}) => {
  const workspace = await createWorkspace(page.request, unique("offline-schedule"));
  const itemIds = Array.from({ length: 4 }, (_, index) => unique(`offline-item-${index + 1}`));
  for (const [index, entityId] of itemIds.entries()) {
    await mutate(page.request, workspace.trip.id, {
      entity: "schedule_item",
      action: "create",
      entityId,
      baseVersion: null,
      payload: {
        tripDayId: workspace.tripDayId,
        placeId: null,
        bookingId: null,
        title: `오프라인 일정 ${index + 1}`,
        startsAt: `2026-10-08T${String(9 + index).padStart(2, "0")}:00:00+11:00`,
        endsAt: null,
        memo: "",
        travelMode: "walk",
        travelNote: "",
        position: index + 1,
        isFixed: false,
        isDone: false
      }
    });
  }

  await page.goto(`/trip/${workspace.trip.id}/schedule`);
  await page.getByRole("radio", { name: "전체 일정" }).click();
  await page.evaluate(async () => Boolean(await navigator.serviceWorker.ready));
  await page.reload();
  await expect.poll(() =>
    page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  ).toBe(true);
  await page.getByRole("radio", { name: "전체 일정" }).click();
  await page.getByRole("button", { name: "순서 편집" }).click();
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "오프라인 일정 4 위로 이동" }).click();
  }
  await page.getByRole("button", { name: "순서 편집 완료" }).click();
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(4);

  await context.setOffline(true);
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("radio", { name: "전체 일정" }).click();
  await expect.poll(() => page.locator("main ul button").allTextContents()).toEqual([
    "오프라인 일정 4",
    "오프라인 일정 1",
    "오프라인 일정 2",
    "오프라인 일정 3"
  ]);

  await page.getByRole("button", { name: "오프라인 일정 4" }).click();
  await page.getByRole("button", { name: "일정 수정" }).click();
  await page.getByLabel("이동 메모").fill("QA-ANDROID-OFFLINE");
  await page.getByRole("button", { name: "저장" }).click();
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(5);
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("radio", { name: "전체 일정" }).click();
  await page.getByRole("button", { name: /오프라인 일정 4/ }).click();
  await expect(page.getByText("도보 · QA-ANDROID-OFFLINE", { exact: true })).toBeVisible();

  const responsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === "POST"
      && candidate.url().endsWith(`/api/trips/${workspace.trip.id}/mutations`)
  );
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  expect((await responsePromise).ok()).toBe(true);
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(0);
  await expect(page.getByRole("dialog", { name: "동기화 충돌" })).toHaveCount(0);

  const snapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
  const reordered = snapshot.scheduleItems
    .filter((item) => item.tripDayId === workspace.tripDayId)
    .sort((left, right) => left.position - right.position);
  expect(reordered.map((item) => item.id)).toEqual([
    itemIds[3],
    itemIds[0],
    itemIds[1],
    itemIds[2]
  ]);
  expect(reordered[0]?.travelNote).toBe("QA-ANDROID-OFFLINE");
});
