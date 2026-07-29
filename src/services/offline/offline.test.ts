import { deleteDB } from "idb";
import { afterEach, describe, expect, it } from "vitest";
import type { MutationRequest } from "../../shared/mutations";
import { createTripSnapshot } from "../../test/snapshotSamples";
import { openTravelDatabase, type TravelDatabase } from "./database";
import { OutboxStore } from "./outboxStore";
import { SettingsStore } from "./settingsStore";
import { SnapshotStore } from "./snapshotStore";
import { MediaThumbnailStore } from "./mediaThumbnailStore";

const databases: TravelDatabase[] = [];
const names: string[] = [];

async function createStores() {
  const name = `couple-travel-guide-test-${crypto.randomUUID()}`;
  const database = await openTravelDatabase(name);
  databases.push(database);
  names.push(name);
  return {
    outbox: new OutboxStore(database),
    settings: new SettingsStore(database),
    snapshots: new SnapshotStore(database),
    thumbnails: new MediaThumbnailStore(database)
  };
}

afterEach(async () => {
  for (const database of databases.splice(0)) database.close();
  await Promise.all(names.splice(0).map((name) => deleteDB(name)));
});

function mutation(idempotencyKey: string, entityId: string): MutationRequest<"note"> {
  return {
    idempotencyKey,
    entity: "note",
    action: "create",
    entityId,
    baseVersion: null,
    payload: {
      targetType: "trip",
      targetId: null,
      visibility: "shared",
      body: entityId,
      attachmentUrl: null
    }
  };
}

describe("offline IndexedDB stores", () => {
  it("persists one coherent snapshot with its ETag", async () => {
    const { snapshots } = await createStores();
    const snapshot = createTripSnapshot();

    await snapshots.put({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });

    expect(await snapshots.get(snapshot.trip.id)).toEqual({
      tripId: snapshot.trip.id,
      snapshot,
      etag: "\"trip-trip-one-7\"",
      savedAt: "2026-07-28T12:00:00.000Z"
    });
  });

  it("caches a representative thumbnail without storing a Drive token", async () => {
    const { thumbnails } = await createStores();
    const blob = new Blob(["thumbnail"], { type: "image/webp" });

    await thumbnails.save("media-one", "trip-one", blob);

    const cached = await thumbnails.get("media-one");
    expect(cached?.type).toBe("image/webp");
    expect(await cached?.text()).toBe("thumbnail");
  });

  it("stores only the minimum offline principal identity", async () => {
    const { snapshots } = await createStores();

    await snapshots.savePrincipal({
      memberId: "partner",
      role: "partner",
      sessionId: "must-not-be-durable"
    });

    expect(await snapshots.getPrincipal()).toEqual({
      memberId: "partner",
      role: "partner"
    });
  });

  it("persists local tool settings without writing prompt content", async () => {
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

  it("lists queued mutations in creation order without changing their idempotency keys", async () => {
    const { outbox } = await createStores();
    const second = mutation("same-key-two", "note-two");
    const first = mutation("same-key-one", "note-one");

    await outbox.enqueue("trip-one", second, "2026-07-28T12:00:02.000Z");
    await outbox.enqueue("trip-one", first, "2026-07-28T12:00:01.000Z");

    expect((await outbox.listForTrip("trip-one")).map((record) => ({
      key: record.idempotencyKey,
      state: record.state,
      attempts: record.attempts
    }))).toEqual([
      { key: "same-key-one", state: "queued", attempts: 0 },
      { key: "same-key-two", state: "queued", attempts: 0 }
    ]);
  });

  it("atomically replaces a conflict with one new queued mutation", async () => {
    const { outbox } = await createStores();
    const conflicting = mutation("conflict-key", "note-one");
    const replacement = {
      ...conflicting,
      idempotencyKey: "replacement-key",
      baseVersion: 4
    };
    await outbox.enqueue("trip-one", conflicting, "2026-07-28T12:00:00.000Z");
    await outbox.markConflict("conflict-key", "VERSION_CONFLICT", {
      id: "note-one",
      version: 4
    });

    await outbox.replaceConflict(
      "conflict-key",
      replacement,
      "2026-07-28T12:01:00.000Z"
    );

    expect(await outbox.get("conflict-key")).toBeUndefined();
    expect(await outbox.get("replacement-key")).toMatchObject({
      mutation: replacement,
      state: "queued",
      attempts: 0,
      conflictCurrent: null
    });
  });
});
