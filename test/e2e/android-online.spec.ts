import { expect, test } from "@playwright/test";
import {
  createWorkspace,
  getSnapshot,
  mutate,
  unique,
} from "./helpers";

test("Android saves schedule order and travel notes directly to the server", async ({
  page,
}) => {
  const workspace = await createWorkspace(page.request, unique("online-schedule"));
  const itemIds = Array.from({ length: 4 }, (_, index) =>
    unique(`online-item-${index + 1}`)
  );
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
        title: `온라인 일정 ${index + 1}`,
        startsAt: `2026-10-08T${String(9 + index).padStart(2, "0")}:00:00+11:00`,
        endsAt: null,
        memo: "",
        travelMode: "walk",
        travelNote: "",
        position: index + 1,
        isFixed: false,
        isDone: false,
      },
    });
  }

  await page.goto(`/trip/${workspace.trip.id}/schedule`);
  await page.getByRole("radio", { name: "전체 일정" }).click();
  await page.getByRole("button", { name: "순서 편집" }).click();
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "온라인 일정 4 위로 이동" }).click();
  }
  await page.getByRole("button", { name: "순서 편집 완료" }).click();

  await expect.poll(async () => {
    const snapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
    return snapshot.scheduleItems
      .filter((item) => item.tripDayId === workspace.tripDayId)
      .sort((left, right) => left.position - right.position)
      .map((item) => item.id);
  }).toEqual([itemIds[3], itemIds[0], itemIds[1], itemIds[2]]);

  await page.getByRole("button", { name: "온라인 일정 4" }).click();
  await page.getByRole("button", { name: "일정 수정" }).click();
  await page.getByLabel("이동 메모").fill("QA-ANDROID-ONLINE");
  await page.getByRole("button", { name: "저장" }).click();
  await page.reload();
  await page.getByRole("radio", { name: "전체 일정" }).click();

  await expect.poll(() => page.locator("main ul button").allTextContents()).toEqual([
    "온라인 일정 4 · QA-ANDROID-ONLINE",
    "온라인 일정 1",
    "온라인 일정 2",
    "온라인 일정 3",
  ]);

  const snapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
  const first = snapshot.scheduleItems
    .filter((item) => item.tripDayId === workspace.tripDayId)
    .sort((left, right) => left.position - right.position)
    .at(0);
  expect(first?.id).toBe(itemIds[3]);
  expect(first?.travelNote).toBe("QA-ANDROID-ONLINE");
  await expect(page.getByRole("dialog", { name: "동기화 충돌" })).toHaveCount(0);
});
