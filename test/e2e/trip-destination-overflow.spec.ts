import { expect, test } from "@playwright/test";
import { BASE_URL, ownerHeaders, unique } from "./helpers";

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2.75,
  hasTouch: true,
  isMobile: true,
});

test("a long edited destination and its suggestion stay inside the mobile trip editor", async ({ page }) => {
  const title = unique("long-destination");
  const destination = "Sydney";
  const editedDestination = "내재베법아브아브아브아브아브아브아브아브아브아브아브아브";
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
  await destinationControl.click();

  const destinationInput = destinationControl.getByRole("combobox");
  await destinationInput.fill(editedDestination);
  const listbox = page.getByRole("listbox", { name: "Search results" });
  const directOption = listbox.getByRole("option").filter({ hasText: "직접 입력" });
  await expect(directOption).toBeVisible();

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const dimensions = await page.evaluate(() => {
      const control = document.querySelector<HTMLElement>("[role='dialog'] .astryx-typeahead");
      const input = control?.querySelector<HTMLElement>("[role='combobox']");
      const dropdown = document.querySelector<HTMLElement>(".astryx-typeahead-dropdown");
      const option = dropdown?.querySelector<HTMLElement>("[role='option']");
      const popover = dropdown?.closest<HTMLElement>("[popover]");
      const dialogElement = control?.closest<HTMLElement>("[role='dialog']");
      if (!control || !input || !dropdown || !option || !popover || !dialogElement) {
        throw new Error("destination typeahead surface is incomplete");
      }
      const rect = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, width: bounds.width };
      };
      return {
        control: rect(control),
        input: rect(input),
        dropdown: rect(dropdown),
        option: rect(option),
        popover: rect(popover),
        dialog: rect(dialogElement),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    for (const surface of [dimensions.control, dimensions.input, dimensions.dropdown, dimensions.option, dimensions.popover]) {
      expect(surface.left).toBeGreaterThanOrEqual(dimensions.control.left - 1);
      expect(surface.right).toBeLessThanOrEqual(dimensions.control.right + 1);
      expect(surface.right).toBeLessThanOrEqual(dimensions.dialog.right + 1);
    }
    expect(dimensions.popover.width).toBeLessThanOrEqual(dimensions.control.width + 1);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  }

  await directOption.click();
  const timeZoneControl = dialog.locator(".astryx-typeahead").nth(1);
  await timeZoneControl.click();
  await timeZoneControl.getByRole("combobox").fill("Sydney");
  await page.getByRole("option").filter({ hasText: "Australia/Sydney" }).first().click();
  await dialog.getByRole("button", { name: "변경 저장" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: `${title} 메뉴` }).click();
  await page.getByRole("menuitem", { name: `${title} 수정` }).click();
  await expect(page.getByRole("dialog", { name: "여행 수정" }).locator(".astryx-typeahead").first())
    .toContainText(editedDestination);
});
