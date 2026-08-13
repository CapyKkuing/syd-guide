import { expect, test } from "@playwright/test";
import { BASE_URL, ownerHeaders, unique } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("a long selected destination stays inside the mobile trip editor", async ({ page }) => {
  const title = unique("long-destination");
  const destination = "Sydney Harbour Eastern Beaches Northern Districts Western Suburbs Southern Highlands Blue Mountains Australia";
  const response = await page.request.post(`${BASE_URL}/api/trips`, {
    headers: ownerHeaders(true),
    data: {
      title,
      destination,
      startDate: "2026-10-08",
      endDate: "2026-10-15",
      timeZone: "Australia/Sydney",
      status: "upcoming",
      coverImageUrl: null,
      outboundFlight: null,
      returnFlight: null,
    },
  });
  expect(response.status()).toBe(201);

  await page.goto("/library");
  await page.getByRole("button", { name: `${title} 메뉴` }).click();
  await page.getByRole("menuitem", { name: `${title} 수정` }).click();

  const dialog = page.getByRole("dialog", { name: "여행 수정" });
  const destinationControl = dialog.locator(".astryx-typeahead").first();
  await expect(destinationControl).toContainText(destination);

  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    const dimensions = await destinationControl.evaluate((element) => ({
      right: element.getBoundingClientRect().right,
      dialogRight: element.closest("[role='dialog']")?.getBoundingClientRect().right ?? 0,
      overflowX: getComputedStyle(element).overflowX,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.dialogRight + 1);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.overflowX).toBe("hidden");
  }

  await dialog.getByRole("button", { name: "변경 저장" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: `${title} 메뉴` }).click();
  await page.getByRole("menuitem", { name: `${title} 수정` }).click();
  await expect(page.getByRole("dialog", { name: "여행 수정" }).locator(".astryx-typeahead").first())
    .toContainText(destination);
});
