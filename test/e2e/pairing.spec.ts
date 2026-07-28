import { expect, test, type Page } from "@playwright/test";
import {
  BASE_URL,
  expireUnusedInvites,
  issueInvite,
  stripDevPrincipal,
  unique
} from "./helpers";

test("QR/link invite lasts ten minutes, claims once, and rejects replay", async ({
  browser,
  page
}) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "여행 서재" })).toBeVisible();
  await page.getByRole("button", { name: "연결 기기" }).click();
  const management = page.getByRole("dialog", { name: "연결 기기 관리" });
  await management.getByRole("button", { name: "초대 만들기" }).click();

  await expect(management.getByRole("img", { name: "파트너 연결 QR 코드" }))
    .toBeVisible();
  await expect(management.getByText(/남은 시간 (10:00|9:59)/)).toBeVisible();
  const inviteUrl = await management.getByLabel("초대 링크").inputValue();
  expect(new URL(inviteUrl).searchParams.get("token")).toHaveLength(43);

  const partnerContext = await browser.newContext({ baseURL: BASE_URL });
  const partnerPage = await partnerContext.newPage();
  await stripDevPrincipal(partnerPage);
  await claim(partnerPage, inviteUrl, unique("partner-phone"));
  await expect(partnerPage.getByRole("heading", { name: "여행 서재" }))
    .toBeVisible();

  const replayContext = await browser.newContext({ baseURL: BASE_URL });
  const replayPage = await replayContext.newPage();
  await claim(replayPage, inviteUrl, unique("replay-phone"), false);
  await expect(replayPage.getByRole("alert")).toHaveText("Invite was already used");

  await replayContext.close();
  await partnerContext.close();
});

test("expired invite is rejected by the claim page", async ({ page }) => {
  const invite = await issueInvite(page.request);
  expect(Date.parse(invite.expiresAt) - Date.now()).toBeGreaterThan(590_000);
  expect(Date.parse(invite.expiresAt) - Date.now()).toBeLessThanOrEqual(600_000);
  await expireUnusedInvites();

  await claim(page, invite.url, unique("expired-phone"), false);
  await expect(page.getByRole("alert")).toHaveText("Invite has expired");
});

test("owner revocation makes the real partner session return 401 immediately", async ({
  browser,
  page
}) => {
  const deviceName = unique("revoked-phone");
  const invite = await issueInvite(page.request);
  const partnerContext = await browser.newContext({ baseURL: BASE_URL });
  const partnerPage = await partnerContext.newPage();
  await stripDevPrincipal(partnerPage);
  await claim(partnerPage, invite.url, deviceName);

  await page.goto("/library");
  await page.getByRole("button", { name: "연결 기기" }).click();
  const device = page.getByRole("listitem").filter({ hasText: deviceName });
  await expect(device).toBeVisible();
  await device.getByRole("button", { name: "연결 해제" }).click();
  await expect(device.getByText("연결 해제됨")).toBeVisible();

  const response = await partnerContext.request.get(`${BASE_URL}/api/session`, {
    headers: { Origin: BASE_URL }
  });
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: { code: "SESSION_REVOKED" }
  });

  await partnerContext.close();
});

test.describe("shared trip lifecycle", () => {
  for (const role of ["owner", "partner"] as const) {
    test(`${role} can create, edit, trash, and restore a trip in the UI`, async ({
      browser,
      page
    }) => {
      let contextToClose: Awaited<ReturnType<typeof browser.newContext>> | null = null;
      let actor = page;
      if (role === "partner") {
        const invite = await issueInvite(page.request);
        contextToClose = await browser.newContext({ baseURL: BASE_URL });
        actor = await contextToClose.newPage();
        await stripDevPrincipal(actor);
        await claim(actor, invite.url, unique("lifecycle-phone"));
      } else {
        await actor.goto("/library");
      }

      const title = unique(`${role}-trip`);
      const updatedTitle = `${title}-updated`;
      await actor.getByRole("button", { name: "새 여행 만들기" }).first().click();
      const createDialog = actor.getByRole("dialog", { name: "새 여행 만들기" });
      await createDialog.getByLabel("여행 제목").fill(title);
      await createDialog.getByLabel("여행지").fill("Sydney");
      await createDialog.getByLabel("시작일").fill("2026-10-08");
      await createDialog.getByLabel("종료일").fill("2026-10-15");
      await createDialog.getByRole("button", { name: "여행 만들기" }).click();
      await expect(actor.getByRole("heading", { name: title })).toBeVisible();

      await actor.getByRole("button", { name: `${title} 메뉴` }).click();
      await actor.getByRole("menuitem", { name: `${title} 수정` }).click();
      const editDialog = actor.getByRole("dialog", { name: "여행 수정" });
      await editDialog.getByLabel("여행 제목").fill(updatedTitle);
      await editDialog.getByRole("button", { name: "변경 저장" }).click();
      await expect(actor.getByRole("heading", { name: updatedTitle })).toBeVisible();

      await actor.getByRole("button", { name: `${updatedTitle} 메뉴` }).click();
      await actor.getByRole("menuitem", {
        name: `${updatedTitle} 휴지통으로 이동`
      }).click();
      await actor.getByRole("dialog", { name: "여행 휴지통 이동 확인" })
        .getByRole("button", { name: "휴지통으로 이동" }).click();
      await expect(actor.getByRole("heading", { name: updatedTitle })).toHaveCount(0);

      await actor.getByRole("button", { name: "휴지통" }).click();
      const trash = actor.getByRole("dialog", { name: "휴지통" });
      await trash.getByRole("button", { name: `${updatedTitle} 복구` }).click();
      await expect(trash.getByRole("button", { name: `${updatedTitle} 복구` }))
        .toHaveCount(0);
      await trash.getByRole("button", { name: "닫기" }).click();
      await expect(actor.getByRole("heading", { name: updatedTitle })).toBeVisible();

      await contextToClose?.close();
    });
  }
});

async function claim(
  page: Page,
  inviteUrl: string,
  deviceName: string,
  expectSuccess = true
) {
  await page.goto(inviteUrl);
  await page.getByLabel("이 기기 이름").fill(deviceName);
  await page.getByRole("button", { name: "기기 연결" }).click();
  if (expectSuccess) {
    await expect(page).toHaveURL(`${BASE_URL}/library`);
  }
}
