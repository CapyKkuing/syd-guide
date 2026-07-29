import type { TripMedia } from "../../../shared/media";
import type { ReelScene, TravelReel } from "./types";

export const AUTO_REEL_MAX_DURATION_MS = 120_000;
export const EDITED_REEL_MAX_DURATION_MS = 180_000;
export const PHOTO_DURATION_MS = 3_000;

interface ComposeReelOptions {
  maxDurationMs?: number;
  similarityHashes?: Readonly<Record<string, string>>;
  tripId?: string;
}

export function composeReel(
  media: TripMedia[],
  options: ComposeReelOptions = {}
): TravelReel {
  const maxDurationMs = options.maxDurationMs ?? AUTO_REEL_MAX_DURATION_MS;
  const ordered = [...media].sort(compareMediaTime);
  const selected: TripMedia[] = [];
  const excludedMediaIds: string[] = [];

  for (const item of ordered) {
    const duplicateIndex = selected.findIndex((candidate) =>
      isSimilar(candidate, item, options.similarityHashes)
    );
    if (duplicateIndex < 0) {
      selected.push(item);
      continue;
    }
    const current = selected[duplicateIndex];
    if (current && compareQuality(item, current) > 0) {
      selected[duplicateIndex] = item;
      excludedMediaIds.push(current.id);
    } else {
      excludedMediaIds.push(item.id);
    }
  }

  const sceneLimit = Math.max(0, Math.floor(maxDurationMs / PHOTO_DURATION_MS));
  const included = selected.slice(0, sceneLimit).sort(compareMediaTime);
  excludedMediaIds.push(...selected.slice(sceneLimit).map((item) => item.id));
  const scenes = included.map(sceneForMedia);

  return {
    tripId: options.tripId ?? media[0]?.tripId ?? "",
    scenes,
    excludedMediaIds: unique(excludedMediaIds),
    durationMs: sumDuration(scenes),
    mode: "auto",
  };
}

export function addScene(reel: TravelReel, media: TripMedia): TravelReel {
  if (reel.scenes.some((scene) => scene.mediaId === media.id)) return reel;
  return editedReel(
    reel,
    [...reel.scenes, sceneForMedia(media)],
    reel.excludedMediaIds.filter((mediaId) => mediaId !== media.id)
  );
}

export function excludeScene(
  reel: TravelReel,
  sceneId: string
): TravelReel {
  const scene = reel.scenes.find((item) => item.id === sceneId);
  if (!scene) return reel;
  return editedReel(
    reel,
    reel.scenes.filter((item) => item.id !== sceneId),
    [...reel.excludedMediaIds, scene.mediaId]
  );
}

export function moveScene(
  reel: TravelReel,
  sceneId: string,
  targetIndex: number
): TravelReel {
  const currentIndex = reel.scenes.findIndex((scene) => scene.id === sceneId);
  if (currentIndex < 0) return reel;
  const next = [...reel.scenes];
  const [scene] = next.splice(currentIndex, 1);
  if (!scene) return reel;
  const boundedIndex = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(boundedIndex, 0, scene);
  return editedReel(reel, next, reel.excludedMediaIds);
}

export function replaceScene(
  reel: TravelReel,
  currentSceneId: string,
  replacement: TripMedia
): TravelReel {
  if (reel.scenes.some((scene) => scene.mediaId === replacement.id)) {
    return reel;
  }
  const currentIndex = reel.scenes.findIndex(
    (scene) => scene.id === currentSceneId
  );
  if (currentIndex < 0) return reel;
  const current = reel.scenes[currentIndex];
  if (!current) return reel;
  const next = [...reel.scenes];
  next[currentIndex] = {
    ...sceneForMedia(replacement),
    durationMs: current.durationMs,
  };
  return editedReel(
    reel,
    next,
    [
      ...reel.excludedMediaIds.filter(
        (mediaId) => mediaId !== replacement.id
      ),
      current.mediaId,
    ]
  );
}

function sceneForMedia(media: TripMedia): ReelScene {
  return {
    id: `scene-${media.id}`,
    mediaId: media.id,
    durationMs: PHOTO_DURATION_MS,
  };
}

function editedReel(
  reel: TravelReel,
  scenes: ReelScene[],
  excludedMediaIds: string[]
): TravelReel {
  const balanced = balanceDuration(scenes, EDITED_REEL_MAX_DURATION_MS);
  return {
    ...reel,
    scenes: balanced,
    excludedMediaIds: unique(excludedMediaIds),
    durationMs: sumDuration(balanced),
    mode: "edited",
  };
}

function balanceDuration(
  scenes: ReelScene[],
  maxDurationMs: number
): ReelScene[] {
  const durationMs = sumDuration(scenes);
  if (durationMs <= maxDurationMs || !scenes.length) return scenes;
  const baseDuration = Math.floor(maxDurationMs / scenes.length);
  let remainder = maxDurationMs - baseDuration * scenes.length;
  return scenes.map((scene) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { ...scene, durationMs: baseDuration + extra };
  });
}

function isSimilar(
  left: TripMedia,
  right: TripMedia,
  hashes: Readonly<Record<string, string>> | undefined
): boolean {
  const leftHash = hashes?.[left.id];
  const rightHash = hashes?.[right.id];
  if (
    leftHash
    && rightHash
    && leftHash.length === rightHash.length
    && hashDistance(leftHash, rightHash) <= 6
  ) {
    return true;
  }
  if (!left.capturedAt || !right.capturedAt) return false;
  const timeGap = Math.abs(
    Date.parse(left.capturedAt) - Date.parse(right.capturedAt)
  );
  return timeGap <= 5_000 && left.aiLabels.some((label) =>
    right.aiLabels.includes(label)
  );
}

function hashDistance(left: string, right: string): number {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

function compareQuality(left: TripMedia, right: TripMedia): number {
  const scoreDifference = (left.aiScore ?? 0) - (right.aiScore ?? 0);
  if (scoreDifference) return scoreDifference;
  return left.width * left.height - right.width * right.height;
}

function compareMediaTime(left: TripMedia, right: TripMedia): number {
  const leftTime = Date.parse(left.capturedAt ?? left.createdAt);
  const rightTime = Date.parse(right.capturedAt ?? right.createdAt);
  return leftTime - rightTime || left.id.localeCompare(right.id);
}

function sumDuration(scenes: ReelScene[]): number {
  return scenes.reduce((total, scene) => total + scene.durationMs, 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
