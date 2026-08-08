import { expect, test } from "@playwright/test";
import {
  createWorkspace,
  getSnapshot,
  mutate,
  unique,
} from "./helpers";

test("an open trip blocks content offline and resumes after reconnection", async ({
  context,
  page,
}) => {
  const workspace = await createWorkspace(page.request, unique("online-required"));
  await page.goto(`/trip/${workspace.trip.id}/tools/notes`);
  await expect(page.getByRole("heading", { name: "여행 메모" })).toBeVisible();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("heading", { name: "인터넷 연결이 필요합니다" }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: "여행 메모" })).toHaveCount(0);
  await expect(page.getByLabel("메모 내용")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual([]);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("heading", { name: "여행 메모" })).toBeVisible();
});

test("an online edit is stored immediately without an outbox conflict dialog", async ({
  page,
}) => {
  const workspace = await createWorkspace(page.request, unique("direct-online-save"));
  const note = unique("direct-online-note");
  await page.goto(`/trip/${workspace.trip.id}/tools/notes`);

  const mutationResponse = page.waitForResponse((candidate) =>
    candidate.request().method() === "POST"
      && candidate.url().endsWith(`/api/trips/${workspace.trip.id}/mutations`)
  );
  await page.getByLabel("메모 내용").fill(note);
  await page.getByRole("button", { name: "메모 추가" }).click();

  expect((await mutationResponse).status()).toBe(200);
  await expect(page.getByText(note)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "동기화 충돌" })).toHaveCount(0);
  const snapshot = await getSnapshot(page.request, workspace.trip.id, "owner");
  expect(snapshot.notes.some((item) => item.body === note)).toBe(true);
});

test("a stale online edit reports the server conflict in its editor", async ({ page }) => {
  const workspace = await createWorkspace(page.request, unique("online-conflict"));
  const placeId = unique("online-conflict-place");
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
    savedBy: "owner",
  };
  await mutate(page.request, workspace.trip.id, {
    entity: "place",
    action: "create",
    entityId: placeId,
    baseVersion: null,
    payload: originalPayload,
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
    payload: { ...originalPayload, name: "서버 최신 장소" },
  });
  await editor.getByLabel("장소 이름").fill("오래된 화면의 수정");
  const conflictResponse = page.waitForResponse((candidate) =>
    candidate.request().method() === "POST"
      && candidate.url().endsWith(`/api/trips/${workspace.trip.id}/mutations`)
      && candidate.status() === 409
  );
  await editor.getByRole("button", { name: "저장" }).click();

  await conflictResponse;
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "동기화 충돌" })).toHaveCount(0);
});
