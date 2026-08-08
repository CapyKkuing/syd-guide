import { expect, test } from "@playwright/test";
import {
  createWorkspace,
  flushOutbox,
  getSnapshot,
  mutate,
  outboxCount,
  unique
} from "./helpers";

test("offline snapshot remains readable and queued edit flushes on reconnect", async ({
  context,
  page
}) => {
  const workspace = await createWorkspace(page.request, unique("offline-workspace"));
  await mutate(page.request, workspace.trip.id, {
    entity: "note",
    action: "create",
    entityId: unique("cached-note"),
    baseVersion: null,
    payload: {
      targetType: "trip",
      targetId: null,
      visibility: "shared",
      body: "온라인에서 저장한 캐시 메모",
      attachmentUrl: null
    }
  });

  await page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await expect(page.getByText("온라인에서 저장한 캐시 메모")).toBeVisible();
  await page.evaluate(async () => Boolean(await navigator.serviceWorker.ready));
  await page.reload();
  await expect.poll(() =>
    page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  ).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("heading", { name: "여행 메모" })).toBeVisible();
  await expect(page.getByText("온라인에서 저장한 캐시 메모")).toBeVisible();
  expect(await page.evaluate(async () => {
    try {
      await fetch(`/api/health?offline=${Date.now()}`, { cache: "no-store" });
      return false;
    } catch {
      return true;
    }
  })).toBe(true);

  await page.getByLabel("메모 내용").fill("오프라인에서 추가한 메모");
  await page.getByRole("button", { name: "메모 추가" }).click();
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(1);

  const responsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === "POST"
      && candidate.url().endsWith(`/api/trips/${workspace.trip.id}/mutations`)
  );
  await context.setOffline(false);
  expect((await responsePromise).ok()).toBe(true);
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(0);
  await expect(page.getByText("오프라인에서 추가한 메모")).toBeVisible();

  const notesUrl = page.url();
  await page.close();
  await context.setOffline(true);
  const coldPage = await context.newPage();
  await coldPage.goto(notesUrl);
  await expect(coldPage.getByRole("heading", { name: "여행 메모" })).toBeVisible();
  await expect(coldPage.getByText("온라인에서 저장한 캐시 메모")).toBeVisible();
  await expect(coldPage.getByText("오프라인에서 추가한 메모")).toBeVisible();
  await context.setOffline(false);
});

test("schedule reorder keeps the complete device order after one conflict choice", async ({
  context,
  page
}) => {
  const workspace = await createWorkspace(page.request, unique("conflict-schedule"));
  const itemIds = Array.from({ length: 4 }, (_, index) =>
    unique(`conflict-schedule-item-${index + 1}`)
  );
  const payloads = itemIds.map((_, index) => ({
    tripDayId: workspace.tripDayId,
    placeId: null,
    bookingId: null,
    title: `충돌 일정 ${index + 1}`,
    startsAt: `2026-10-08T${String(9 + index).padStart(2, "0")}:00:00+11:00`,
    endsAt: null,
    memo: "",
    travelMode: "walk" as const,
    travelNote: index === 3 ? "QA-ANDROID-OFFLINE" : "",
    position: index + 1,
    isFixed: false,
    isDone: false
  }));
  for (const [index, entityId] of itemIds.entries()) {
    await mutate(page.request, workspace.trip.id, {
      entity: "schedule_item",
      action: "create",
      entityId,
      baseVersion: null,
      payload: payloads[index]!
    });
  }

  await page.goto(`/trip/${workspace.trip.id}/schedule`);
  await page.getByRole("radio", { name: "전체 일정" }).click();
  await expect.poll(() => page.locator("main ul button").allTextContents()).toEqual([
    "충돌 일정 1",
    "충돌 일정 2",
    "충돌 일정 3",
    "충돌 일정 4 · QA-ANDROID-OFFLINE"
  ]);

  for (const [index, entityId] of itemIds.entries()) {
    await mutate(page.request, workspace.trip.id, {
      entity: "schedule_item",
      action: "update",
      entityId,
      baseVersion: 1,
      payload: payloads[index]!
    });
  }

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: "순서 편집" }).click();
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "충돌 일정 4 위로 이동" }).click();
  }
  await page.getByRole("button", { name: "순서 편집 완료" }).click();
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(1);

  const conflictResponse = page.waitForResponse((candidate) =>
    candidate.request().method() === "POST"
      && candidate.url().endsWith(`/api/trips/${workspace.trip.id}/mutations`)
      && candidate.status() === 409
  );
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await conflictResponse;

  const conflict = page.getByRole("dialog", { name: "동기화 충돌" });
  await expect(conflict).toBeVisible();
  await conflict.getByRole("button", { name: "내 수정 유지" }).click();

  await expect(conflict).toHaveCount(0);
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(0);
  await page.reload();
  await page.getByRole("radio", { name: "전체 일정" }).click();
  await expect.poll(() => page.locator("main ul button").allTextContents()).toEqual([
    "충돌 일정 4 · QA-ANDROID-OFFLINE",
    "충돌 일정 1",
    "충돌 일정 2",
    "충돌 일정 3"
  ]);

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

for (const choice of ["latest", "mine"] as const) {
  test(`conflict dialog resolves with ${choice}`, async ({ page }) => {
    const workspace = await createWorkspace(page.request, unique(`conflict-${choice}`));
    const placeId = unique(`conflict-place-${choice}`);
    const originalPayload = {
      name: "처음 저장한 장소",
      category: "cafe" as const,
      status: "saved" as const,
      address: "Sydney",
      latitude: null,
      longitude: null,
      mapUrl: null,
      sourceUrl: null,
      imageUrl: null,
      description: "",
      savedBy: "owner"
    };
    await mutate(page.request, workspace.trip.id, {
      entity: "place",
      action: "create",
      entityId: placeId,
      baseVersion: null,
      payload: originalPayload
    });

    await page.goto(`/trip/${workspace.trip.id}/map`);
    await expect(page.getByRole("heading", { name: "처음 저장한 장소" })).toBeVisible();
    await page.getByRole("button", { name: "상세 보기" }).click();
    await page.getByRole("button", { name: "장소 수정" }).click();
    const editor = page.getByRole("dialog", { name: "장소 수정" });

    await mutate(page.request, workspace.trip.id, {
      entity: "place",
      action: "update",
      entityId: placeId,
      baseVersion: 1,
      payload: { ...originalPayload, name: "서버 최신 장소" }
    });
    await editor.getByLabel("장소 이름").fill("내 충돌 장소");
    await editor.getByRole("button", { name: "저장" }).click();
    await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(1);

    await flushOutbox(page, workspace.trip.id, 409);
    const conflict = page.getByRole("dialog", { name: "동기화 충돌" });
    await expect(conflict).toBeVisible();
    await expect(conflict.getByText("서버 최신 장소")).toBeVisible();

    if (choice === "latest") {
      await conflict.getByRole("button", { name: "최신 내용 사용" }).click();
      await expect(conflict).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "서버 최신 장소" }))
        .toBeVisible();
    } else {
      const responsePromise = page.waitForResponse((candidate) =>
        candidate.request().method() === "POST"
          && candidate.url().endsWith(`/api/trips/${workspace.trip.id}/mutations`)
          && candidate.status() === 200
      );
      await conflict.getByRole("button", { name: "내 수정 유지" }).click();
      await responsePromise;
      await expect(conflict).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "내 충돌 장소" }))
        .toBeVisible();
    }

    const snapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
    expect(snapshot.places.find((place) => place.id === placeId)?.name)
      .toBe(choice === "latest" ? "서버 최신 장소" : "내 충돌 장소");
  });
}
