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

  await page.goto(`/trip/${workspace.trip.id}/tools`);
  await expect(page.getByText("온라인에서 저장한 캐시 메모")).toBeVisible();
  await page.evaluate(async () => Boolean(await navigator.serviceWorker.ready));
  await page.reload();
  await expect.poll(() =>
    page.evaluate(() => Boolean(navigator.serviceWorker.controller))
  ).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("heading", { name: "도구" })).toBeVisible();
  await expect(page.getByText("온라인에서 저장한 캐시 메모")).toBeVisible();
  await expect(page.getByText("오프라인", { exact: true })).toBeVisible();

  await page.getByLabel("메모 내용").fill("오프라인에서 추가한 메모");
  await page.getByRole("button", { name: "메모 추가" }).click();
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(1);
  await expect(page.getByText("대기 1건")).toBeVisible();

  const responsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === "POST"
      && candidate.url().endsWith(`/api/trips/${workspace.trip.id}/mutations`)
  );
  await context.setOffline(false);
  expect((await responsePromise).ok()).toBe(true);
  await expect.poll(() => outboxCount(page, workspace.trip.id)).toBe(0);
  await expect(page.getByText("오프라인에서 추가한 메모")).toBeVisible();
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
    await page.getByRole("button", { name: /처음 저장한 장소/ }).click();
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
      await expect(page.getByRole("button", { name: /서버 최신 장소/ }))
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
      await expect(page.getByRole("button", { name: /내 충돌 장소/ }))
        .toBeVisible();
    }

    const snapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
    expect(snapshot.places.find((place) => place.id === placeId)?.name)
      .toBe(choice === "latest" ? "서버 최신 장소" : "내 충돌 장소");
  });
}
