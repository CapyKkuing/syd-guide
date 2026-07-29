import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { TripMedia } from "../../src/shared/media";
import type { TravelReel } from "../../src/features/memories/reel/types";
import {
  BASE_URL,
  createWorkspace,
  ownerHeaders,
  unique,
} from "./helpers";

test("photo reel keeps duration, playback, visibility, and landscape contracts", async ({
  page,
}) => {
  const workspace = await createWorkspace(
    page.request,
    unique("memory-reel"),
    "owner",
    { status: "completed" },
  );
  const media = await seedMedia(page.request, workspace.trip.id);
  const reel = reelFor(workspace.trip.id, media, 10_000, "auto");

  await page.goto("/library");
  await seedLocalReel(page, reel, media);
  expect(await savedReelDuration(page, workspace.trip.id)).toBeLessThanOrEqual(120_000);

  await page.goto(`/trip/${workspace.trip.id}/memories/play`);
  const player = page.getByRole("main", {
    name: `${workspace.trip.title} 사진 릴 플레이어`,
  });
  await expect(player).toBeVisible();
  const controls = page.locator(".reel-player__controls");
  await expect(controls).toHaveAttribute("aria-hidden", "true");

  await page.getByRole("button", { name: "재생 컨트롤 표시" }).click();
  await expect(page.getByRole("button", { name: "일시정지" })).toBeVisible();
  const running = await progress(page, 0);
  await page.waitForTimeout(250);
  expect(await progress(page, 0)).toBeGreaterThan(running);

  await page.getByRole("button", { name: "일시정지" }).click();
  const paused = await progress(page, 0);
  await page.waitForTimeout(300);
  expect(Math.abs(await progress(page, 0) - paused)).toBeLessThan(0.01);
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.waitForTimeout(250);
  expect(await progress(page, 0)).toBeGreaterThan(paused);

  await page.getByRole("button", { name: "다음 사진" }).click();
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "일시정지" })).toBeVisible();

  await simulateHiddenAndVisible(page);
  await expect(page.getByRole("button", { name: "재생", exact: true })).toBeVisible();
  expect(await progress(page, 1)).toBe(0);

  await page.getByRole("button", { name: "이전 사진" }).click();
  await expect(page.getByRole("img", { name: "1번째 여행 사진" })).toBeVisible();
  expect(await page.locator(".reel-player__photo").evaluate((element) =>
    getComputedStyle(element).objectFit,
  )).toBe("contain");
  expect(await page.locator(".reel-player__background").evaluate((element) =>
    getComputedStyle(element).objectFit,
  )).toBe("cover");

  await page.evaluate((tripId) => {
    sessionStorage.setItem(
      `travel-reel-checkpoint:${tripId}`,
      JSON.stringify({ sceneId: "scene-2", completed: false }),
    );
  }, workspace.trip.id);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "이어서 볼까요?" })).toBeVisible();
  await page.getByRole("button", { name: "이어보기" }).click();
  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  expect(await progress(page, 1)).toBeLessThan(0.05);

  const edited = reelFor(workspace.trip.id, media, 90_000, "edited");
  await saveReel(page, edited);
  await page.goto(`/trip/${workspace.trip.id}/memories`);
  await expect(page.getByText("3:00", { exact: true })).toBeVisible();
  expect(await savedReelDuration(page, workspace.trip.id)).toBeLessThanOrEqual(180_000);

  const other = await createWorkspace(page.request, unique("memory-private"));
  await page.goto(`/trip/${other.trip.id}/memories/play`);
  await expect(page.getByRole("heading", {
    name: "재생할 사진 릴이 없습니다",
  })).toBeVisible();
});

async function seedMedia(
  request: APIRequestContext,
  tripId: string,
): Promise<TripMedia[]> {
  const storage = await request.put(
    `${BASE_URL}/api/trips/${tripId}/media/storage`,
    {
      headers: ownerHeaders(true),
      data: {
        provider: "google-drive",
        rootObjectId: unique("drive-root"),
      },
    },
  );
  expect(storage.ok()).toBe(true);

  const inputs = [
    {
      originalName: "harbour-landscape.jpg",
      width: 1600,
      height: 900,
    },
    {
      originalName: "opera-portrait.jpg",
      width: 900,
      height: 1600,
    },
  ];
  const media: TripMedia[] = [];
  for (const [index, item] of inputs.entries()) {
    const response = await request.post(`${BASE_URL}/api/trips/${tripId}/media`, {
      headers: ownerHeaders(true),
      data: {
        provider: "google-drive",
        providerObjectId: unique(`drive-photo-${index}`),
        thumbnailObjectId: unique(`drive-thumb-${index}`),
        originalName: item.originalName,
        mimeType: "image/jpeg",
        width: item.width,
        height: item.height,
        capturedAt: new Date(Date.now() + index * 1_000).toISOString(),
        aiScore: 0.9 - index * 0.1,
        aiLabels: ["Sydney"],
      },
    });
    expect(response.status()).toBe(201);
    media.push((await response.json() as { media: TripMedia }).media);
  }
  return media;
}

function reelFor(
  tripId: string,
  media: TripMedia[],
  durationMs: number,
  mode: TravelReel["mode"],
): TravelReel {
  return {
    tripId,
    scenes: media.map((item, index) => ({
      id: `scene-${index + 1}`,
      mediaId: item.id,
      durationMs,
    })),
    excludedMediaIds: [],
    durationMs: durationMs * media.length,
    mode,
  };
}

async function seedLocalReel(
  page: Page,
  reel: TravelReel,
  media: TripMedia[],
): Promise<void> {
  await page.evaluate(async ({ savedReel, savedMedia }) => {
    const database = await openDatabase();
    const imageUrls = [
      "/images/sydney_harbour_bridge.jpg",
      "/images/sydney_opera_house.jpg",
    ];
    const images = await Promise.all(
      imageUrls.map(async (url) => (await fetch(url)).arrayBuffer()),
    );
    const transaction = database.transaction(
      ["reels", "mediaThumbnails"],
      "readwrite",
    );
    transaction.objectStore("reels").put(savedReel);
    for (const [index, item] of savedMedia.entries()) {
      transaction.objectStore("mediaThumbnails").put({
        mediaId: item.id,
        tripId: item.tripId,
        bytes: images[index]!,
        mimeType: "image/jpeg",
        cachedAt: new Date().toISOString(),
      });
    }
    await transactionDone(transaction);
    database.close();

    function openDatabase(): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open("couple-travel-guide", 3);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("snapshots")) {
            database.createObjectStore("snapshots", { keyPath: "tripId" });
          }
          if (!database.objectStoreNames.contains("outbox")) {
            const outbox = database.createObjectStore("outbox", {
              keyPath: "idempotencyKey",
            });
            outbox.createIndex("by-trip-created", ["tripId", "createdAt"]);
          }
          if (!database.objectStoreNames.contains("settings")) {
            database.createObjectStore("settings", { keyPath: "key" });
          }
          if (!database.objectStoreNames.contains("mediaThumbnails")) {
            const thumbnails = database.createObjectStore("mediaThumbnails", {
              keyPath: "mediaId",
            });
            thumbnails.createIndex("by-trip", "tripId");
          }
          if (!database.objectStoreNames.contains("reels")) {
            database.createObjectStore("reels", { keyPath: "tripId" });
          }
        };
        request.onsuccess = () => resolve(request.result);
      });
    }

    function transactionDone(transaction: IDBTransaction): Promise<void> {
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    }
  }, { savedReel: reel, savedMedia: media });
}

async function saveReel(page: Page, reel: TravelReel): Promise<void> {
  await page.evaluate(async (savedReel) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("couple-travel-guide", 3);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction("reels", "readwrite");
    transaction.objectStore("reels").put(savedReel);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, reel);
}

async function savedReelDuration(page: Page, tripId: string): Promise<number> {
  return page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("couple-travel-guide", 3);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction("reels");
    const reel = await new Promise<{ durationMs: number }>((resolve, reject) => {
      const request = transaction.objectStore("reels").get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    database.close();
    return reel.durationMs;
  }, tripId);
}

async function progress(page: Page, index: number): Promise<number> {
  const style = await page.locator(".reel-player__progress-track > span")
    .nth(index)
    .getAttribute("style");
  return Number(style?.match(/scaleX\(([^)]+)\)/)?.[1] ?? 0);
}

async function simulateHiddenAndVisible(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
