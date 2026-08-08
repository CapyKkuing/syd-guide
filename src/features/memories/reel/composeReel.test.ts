import { describe, expect, it } from "vitest";
import type { TripMedia } from "../../../shared/media";
import {
  addScene,
  composeReel,
  excludeScene,
  moveScene,
  replaceScene,
} from "./composeReel";
import type { TravelReel } from "./types";

function photo(index: number, overrides: Partial<TripMedia> = {}): TripMedia {
  return {
    id: `media-${String(index).padStart(3, "0")}`,
    tripId: "trip-one",
    kind: "photo",
    provider: "google-drive",
    providerObjectId: `original-${index}`,
    thumbnailObjectId: `thumb-${index}`,
    originalName: `photo-${index}.jpg`,
    mimeType: "image/jpeg",
    width: 1600,
    height: 900,
    capturedAt: null,
    aiScore: 0.5,
    aiLabels: ["harbor"],
    createdBy: "owner",
    createdAt: new Date(Date.UTC(2026, 6, 1, 0, index)).toISOString(),
    ...overrides,
  };
}

describe("composeReel", () => {
  it("keeps an automatic photo reel at or below two minutes", () => {
    const reel = composeReel(
      Array.from({ length: 41 }, (_, index) => photo(index))
    );

    expect(reel.durationMs).toBe(120_000);
    expect(reel.scenes).toHaveLength(40);
    expect(reel.excludedMediaIds).toContain("media-040");
  });

  it("keeps the trip key when an automatic reel has no photos", () => {
    expect(composeReel([], { tripId: "trip-empty" })).toMatchObject({
      tripId: "trip-empty",
      scenes: [],
      durationMs: 0,
    });
  });

  it("orders by captured time and falls back to upload time", () => {
    const capturedLater = photo(1, {
      capturedAt: "2026-07-02T09:00:00+10:00",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    const capturedEarlier = photo(2, {
      capturedAt: "2026-07-01T09:00:00+10:00",
      createdAt: "2026-07-02T00:00:00.000Z",
    });
    const uploadedLater = photo(3, {
      capturedAt: null,
      createdAt: "2026-07-04T00:00:00.000Z",
    });
    const uploadedEarlier = photo(4, {
      capturedAt: null,
      createdAt: "2026-07-03T00:00:00.000Z",
    });

    expect(composeReel([capturedLater, capturedEarlier]).scenes)
      .toEqual([
        expect.objectContaining({ mediaId: capturedEarlier.id }),
        expect.objectContaining({ mediaId: capturedLater.id }),
      ]);
    expect(composeReel([uploadedLater, uploadedEarlier]).scenes)
      .toEqual([
        expect.objectContaining({ mediaId: uploadedEarlier.id }),
        expect.objectContaining({ mediaId: uploadedLater.id }),
      ]);
  });

  it("keeps the stronger photo from one temporary perceptual-hash group", () => {
    const first = photo(1, { aiScore: 0.4 });
    const stronger = photo(2, { aiScore: 0.9 });

    const reel = composeReel([first, stronger], {
      similarityHashes: {
        [first.id]: "0".repeat(64),
        [stronger.id]: `${"0".repeat(60)}1111`,
      },
    });

    expect(reel.scenes.map((scene) => scene.mediaId)).toEqual([stronger.id]);
    expect(reel.excludedMediaIds).toEqual([first.id]);
  });

  it("never lets an edited photo reel exceed three minutes", () => {
    const scenes = Array.from({ length: 60 }, (_, index) => ({
      id: `scene-media-${index}`,
      mediaId: `media-${index}`,
      durationMs: 3_000,
    }));
    const reel: TravelReel = {
      tripId: "trip-one",
      scenes,
      excludedMediaIds: [],
      durationMs: 180_000,
      mode: "edited",
    };

    const next = addScene(reel, photo(61));

    expect(next.durationMs).toBeLessThanOrEqual(180_000);
    expect(next.scenes).toHaveLength(61);
  });

  it("replaces in place and moves the old scene to excluded media", () => {
    const reel = composeReel([photo(1), photo(2)]);
    const replacement = photo(3);

    const next = replaceScene(reel, "scene-media-002", replacement);

    expect(next.scenes[1]?.mediaId).toBe(replacement.id);
    expect(next.excludedMediaIds).toContain("media-002");
  });

  it("moves and excludes scenes without mutating the source reel", () => {
    const reel = composeReel([photo(1), photo(2), photo(3)]);
    const moved = moveScene(reel, "scene-media-003", 0);
    const excluded = excludeScene(moved, "scene-media-002");

    expect(moved.scenes.map((scene) => scene.mediaId)).toEqual([
      "media-003",
      "media-001",
      "media-002",
    ]);
    expect(excluded.scenes.map((scene) => scene.mediaId)).toEqual([
      "media-003",
      "media-001",
    ]);
    expect(reel.scenes.map((scene) => scene.mediaId)).toEqual([
      "media-001",
      "media-002",
      "media-003",
    ]);
  });
});
