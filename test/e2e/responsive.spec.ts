import { expect, test } from "@playwright/test";
import {
  createWorkspace,
  expectNoHorizontalOverflow,
  mutate,
  unique
} from "./helpers";

async function expectNoElementOverflow(locator: import("@playwright/test").Locator) {
  const dimensions = await locator.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
}

test("pre-trip gaps open their direct input surfaces without horizontal clipping", async ({
  page
}) => {
  const workspace = await createWorkspace(page.request, unique("direct-pretrip"));
  const todayPath = `/trip/${workspace.trip.id}/today`;

  await page.goto(todayPath);
  await page.locator(".urgent-gap-list li").filter({ hasText: "항공편 확인" })
    .getByRole("link", { name: "확인" }).click();
  const tripDialog = page.getByRole("dialog", { name: "여행 수정" });
  await expect(tripDialog).toBeVisible();
  await expect(tripDialog.locator(".trip-form__flight")).toHaveCount(2);
  await expectNoElementOverflow(tripDialog);

  await page.goto(todayPath);
  await page.locator(".urgent-gap-list li").filter({ hasText: "숙소 예약" })
    .getByRole("link", { name: "확인" }).click();
  const bookingDialog = page.getByRole("dialog", { name: "예약 추가" });
  await expect(bookingDialog).toBeVisible();
  await expect(bookingDialog.getByLabel("예약 종류")).toHaveValue("lodging");
  await expectNoElementOverflow(bookingDialog);

  await page.goto(todayPath);
  await page.locator(".urgent-gap-list li").filter({ hasText: "여권 확인" })
    .getByRole("link", { name: "확인" }).click();
  const passportEditor = page.locator(".checklist-add-panel");
  await expect(passportEditor).toHaveAttribute("open", "");
  await expect(passportEditor.getByLabel("준비물", { exact: true })).toHaveValue("여권");
  await expect(passportEditor.getByRole("combobox", { name: "준비물 범위", exact: true })).toHaveValue("personal");
  await expect(passportEditor.getByRole("combobox", { name: "필수 준비 구분", exact: true })).toHaveValue("passport");
  await expectNoHorizontalOverflow(page);
});

test("target viewports keep primary routes inside the viewport", async ({
  page
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const workspace = await createWorkspace(page.request, unique("responsive"));
  await mutate(page.request, workspace.trip.id, {
    entity: "place",
    action: "create",
    entityId: unique("responsive-place"),
    baseVersion: null,
    payload: {
      name: "반응형 장소",
      category: "attraction",
      status: "saved",
      address: "Sydney",
      latitude: null,
      longitude: null,
      mapUrl: null,
      sourceUrl: null,
      imageUrl: null,
      description: "",
      savedBy: "owner"
    }
  });

  for (const path of [
    "/library",
    `/trip/${workspace.trip.id}/today`,
    `/trip/${workspace.trip.id}/schedule`,
    `/trip/${workspace.trip.id}/map`,
    `/trip/${workspace.trip.id}/tools`,
    `/trip/${workspace.trip.id}/memories`
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }
  expect(errors).toEqual([]);
});

test("keyboard navigation, sheet Escape, and focus return remain usable", async ({
  page
}, testInfo) => {
  const workspace = await createWorkspace(page.request, unique("keyboard"));
  await page.goto("/library");
  const skipLink = page.getByRole("link", { name: "본문으로 건너뛰기" });
  if (testInfo.project.name.includes("webkit")) {
    await skipLink.focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(skipLink).toBeFocused();

  const opener = page.getByRole("button", { name: "새 여행 만들기" }).first();
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "새 여행 만들기" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "닫기" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("여행 제목")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await page.goto(`/trip/${workspace.trip.id}/today`);
  const scheduleLink = page.getByRole("navigation", { name: "여행 메뉴" })
    .getByRole("link", { name: "일정" });
  await scheduleLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/trip/${workspace.trip.id}/schedule$`));
  await expect(page.getByRole("heading", { name: "일정" })).toBeVisible();
});

test("reduced motion and light, dark, and system themes are applied", async ({
  page
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/library");
  expect(await page.evaluate(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const transitionSeconds = await page.getByRole("button", {
    name: "새 여행 만들기"
  }).first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration)
  );
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);

  await page.getByRole("radio", { name: "라이트" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("radio", { name: "다크" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "시스템" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("PWA manifest remains installable while offline caches are disabled", async ({ page }) => {
  await page.goto("/library");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const response = await page.request.get(new URL(manifestHref!, page.url()).toString());
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    name: "우리만의 여행 가이드북",
    display: "standalone",
    start_url: "/"
  });
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).length
  )).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => caches.keys()))
    .toEqual([]);
});
