import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page
} from "@playwright/test";
import type { TripSnapshot } from "../../src/shared/api";
import type { EntityKind, Trip } from "../../src/shared/entities";
import type { FlightDetails } from "../../src/shared/flights";
import type { MutationRequest } from "../../src/shared/mutations";

export const BASE_URL = "http://localhost:4173";

const executeFile = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const wrangler = fileURLToPath(
  new URL("../../node_modules/wrangler/bin/wrangler.js", import.meta.url)
);

type RequestRole = "owner" | "partner" | "session";
type MutationInput<K extends EntityKind> = Omit<
  MutationRequest<K>,
  "idempotencyKey"
>;

export interface Invite {
  url: string;
  token: string;
  expiresAt: string;
}

export interface WorkspaceSeed {
  trip: Trip;
  tripDayId: string;
}

export interface WorkspaceOptions {
  coverImageUrl?: string | null;
  endDate?: string;
  outboundFlight?: FlightDetails | null;
  returnFlight?: FlightDetails | null;
  startDate?: string;
  status?: Trip["status"];
  timeZone?: string;
}

export function unique(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function ownerHeaders(json = false): Record<string, string> {
  return requestHeaders("owner", json);
}

export async function issueInvite(
  request: APIRequestContext
): Promise<Invite> {
  const response = await request.post(`${BASE_URL}/api/admin/invites`, {
    headers: ownerHeaders()
  });
  expect(response.status()).toBe(201);
  return (await response.json() as { invite: Invite }).invite;
}

export async function expireUnusedInvites(): Promise<void> {
  await runD1(
    "UPDATE pair_invites SET expires_at = '2000-01-01T00:00:00.000Z' WHERE used_at IS NULL"
  );
}

export async function stripDevPrincipal(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const headers = { ...route.request().headers() };
    delete headers["x-dev-principal"];
    await route.continue({ headers });
  });
}

export async function createPairedPartner(
  browser: Browser,
  ownerRequest: APIRequestContext,
  deviceName: string
): Promise<{ context: BrowserContext; page: Page }> {
  const invite = await issueInvite(ownerRequest);
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await stripDevPrincipal(page);
  await page.goto(invite.url);
  await page.getByLabel("이 기기 이름").fill(deviceName);
  await page.getByRole("button", { name: "기기 연결" }).click();
  await expect(page).toHaveURL(`${BASE_URL}/library`);
  await expect(page.getByRole("heading", { name: "여행 서재" })).toBeVisible();
  return { context, page };
}

export async function createWorkspace(
  request: APIRequestContext,
  title: string,
  role: RequestRole = "owner",
  options: WorkspaceOptions = {},
): Promise<WorkspaceSeed> {
  const response = await request.post(`${BASE_URL}/api/trips`, {
    headers: requestHeaders(role, true),
    data: {
      title,
      destination: "Sydney",
      startDate: options.startDate ?? "2026-10-08",
      endDate: options.endDate ?? "2026-10-15",
      timeZone: options.timeZone ?? "Australia/Sydney",
      status: options.status ?? "upcoming",
      coverImageUrl: options.coverImageUrl ?? "/images/sydney_harbour_bridge.jpg",
      outboundFlight: options.outboundFlight ?? null,
      returnFlight: options.returnFlight ?? null,
    }
  });
  expect(response.status()).toBe(201);
  const trip = (await response.json() as { trip: Trip }).trip;
  const tripDayId = unique("day");
  await mutate(request, trip.id, {
    entity: "trip_day",
    action: "create",
    entityId: tripDayId,
    baseVersion: null,
    payload: {
      dayDate: "2026-10-08",
      title: "첫째 날",
      position: 1
    }
  }, role);
  return { trip, tripDayId };
}

export async function mutate<K extends EntityKind>(
  request: APIRequestContext,
  tripId: string,
  input: MutationInput<K>,
  role: RequestRole = "owner"
): Promise<void> {
  const response = await request.post(
    `${BASE_URL}/api/trips/${encodeURIComponent(tripId)}/mutations`,
    {
      headers: requestHeaders(role, true),
      data: {
        idempotencyKey: unique("mutation"),
        ...input
      }
    }
  );
  expect(response.status()).toBe(200);
}

export async function getSnapshot(
  request: APIRequestContext,
  tripId: string,
  role: RequestRole
): Promise<TripSnapshot> {
  const response = await request.get(
    `${BASE_URL}/api/trips/${encodeURIComponent(tripId)}/snapshot`,
    { headers: requestHeaders(role) }
  );
  expect(response.status()).toBe(200);
  return response.json() as Promise<TripSnapshot>;
}

export async function flushOutbox(
  page: Page,
  tripId: string,
  expectedStatus = 200
) {
  await expect.poll(() => outboxCount(page, tripId)).toBeGreaterThan(0);
  const responsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST"
      && response.url().endsWith(`/api/trips/${tripId}/mutations`)
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const response = await responsePromise;
  expect(response.status()).toBe(expectedStatus);
  if (expectedStatus === 200) {
    await expect.poll(() => outboxCount(page, tripId)).toBe(0);
  }
  return response;
}

export async function outboxCount(page: Page, tripId: string): Promise<number> {
  return page.evaluate(async (expectedTripId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("couple-travel-guide");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    try {
      const records = await new Promise<Array<{ tripId: string }>>(
        (resolve, reject) => {
          const request = database.transaction("outbox").objectStore("outbox").getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () =>
            resolve(request.result as Array<{ tripId: string }>);
        }
      );
      return records.filter((record) => record.tripId === expectedTripId).length;
    } finally {
      database.close();
    }
  }, tripId);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

function requestHeaders(
  role: RequestRole,
  json = false
): Record<string, string> {
  const headers: Record<string, string> = { Origin: BASE_URL };
  if (json) headers["Content-Type"] = "application/json";
  if (role === "owner" || role === "partner") {
    headers["X-Dev-Principal"] = role;
  }
  return headers;
}

async function runD1(sql: string): Promise<void> {
  await executeFile(process.execPath, [
    wrangler,
    "d1",
    "execute",
    "couple-travel-guide",
    "--local",
    "--persist-to",
    ".tmp/e2e-state",
    "--config",
    "wrangler.jsonc",
    "--command",
    sql
  ], {
    cwd: projectRoot,
    windowsHide: true
  });
}
