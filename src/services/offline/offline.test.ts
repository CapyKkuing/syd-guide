import { deleteDB, openDB, type DBSchema } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import { ReelStore } from "../../features/memories/reel/reelStore";
import { openTravelDatabase, type TravelDatabase } from "./database";
import { MediaThumbnailStore } from "./mediaThumbnailStore";
import { SettingsStore } from "./settingsStore";

interface LegacyDatabaseSchema extends DBSchema {
  snapshots: {
    key: string;
    value: { tripId: string };
  };
  outbox: {
    key: string;
    value: { idempotencyKey: string };
    indexes: { "by-trip-created": [string, string] };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
  mediaThumbnails: {
    key: string;
    value: { mediaId: string };
    indexes: { "by-trip": string };
  };
  reels: {
    key: string;
    value: { tripId: string };
  };
}

const databases: TravelDatabase[] = [];
const names: string[] = [];

async function createStores() {
  const name = `couple-travel-guide-test-${crypto.randomUUID()}`;
  const database = await openTravelDatabase(name);
  databases.push(database);
  names.push(name);
  return {
    settings: new SettingsStore(database),
    thumbnails: new MediaThumbnailStore(database),
    reels: new ReelStore(database)
  };
}

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(names.splice(0).map((name) => deleteDB(name)));
});

describe("device-local IndexedDB stores", () => {
  it("removes legacy trip snapshots, outbox entries, and the offline principal", async () => {
    const name = `couple-travel-guide-legacy-${crypto.randomUUID()}`;
    names.push(name);
    const legacy = await openDB<LegacyDatabaseSchema>(name, 3, {
      upgrade(database) {
        database.createObjectStore("snapshots", { keyPath: "tripId" });
        const outbox = database.createObjectStore("outbox", {
          keyPath: "idempotencyKey"
        });
        outbox.createIndex("by-trip-created", ["tripId", "createdAt"]);
        database.createObjectStore("settings", { keyPath: "key" });
        const thumbnails = database.createObjectStore("mediaThumbnails", {
          keyPath: "mediaId"
        });
        thumbnails.createIndex("by-trip", "tripId");
        database.createObjectStore("reels", { keyPath: "tripId" });
      }
    });
    await legacy.put("settings", {
      key: "session-principal",
      value: { memberId: "owner", role: "owner" }
    });
    await legacy.put("settings", { key: "ai-provider", value: "device" });
    legacy.close();

    const database = await openTravelDatabase(name);
    databases.push(database);

    expect(database.objectStoreNames.contains("snapshots")).toBe(false);
    expect(database.objectStoreNames.contains("outbox")).toBe(false);
    expect(await database.get("settings", "session-principal")).toBeUndefined();
    expect(await database.get("settings", "ai-provider")).toEqual({
      key: "ai-provider",
      value: "device"
    });
  });

  it("keeps representative thumbnails without storing a Drive token", async () => {
    const { thumbnails } = await createStores();
    const blob = new Blob(["thumbnail"], { type: "image/webp" });

    await thumbnails.save("media-one", "trip-one", blob);

    const cached = await thumbnails.get("media-one");
    expect(cached?.type).toBe("image/webp");
    expect(await cached?.text()).toBe("thumbnail");
  });

  it("keeps reel scene metadata without photo bytes or object URLs", async () => {
    const { reels } = await createStores();
    const reel = {
      tripId: "trip-one",
      scenes: [{ id: "scene-media-one", mediaId: "media-one", durationMs: 3_000 }],
      excludedMediaIds: ["media-two"],
      durationMs: 3_000,
      mode: "edited" as const
    };

    await reels.save(reel);

    expect(await reels.get("trip-one")).toEqual(reel);
    expect(JSON.stringify(await reels.get("trip-one"))).not.toContain("blob:");
  });

  it("keeps device-only tool settings without prompt history", async () => {
    const { settings } = await createStores();

    await settings.set("ai-provider", "gemini");
    await settings.set("currency-latest", {
      rate: 910.25,
      fetchedAt: "2026-07-28T12:00:00.000Z"
    });

    expect(await settings.get("ai-provider")).toBe("gemini");
    expect(await settings.get("currency-latest")).toEqual({
      rate: 910.25,
      fetchedAt: "2026-07-28T12:00:00.000Z"
    });
    expect(await settings.get("ai-prompt-history")).toBeUndefined();
  });
});
