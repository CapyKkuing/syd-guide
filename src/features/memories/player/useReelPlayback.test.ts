import { describe, expect, it } from "vitest";
import type { TravelReel } from "../reel/types";
import {
  playbackReducer,
  resumeFrom,
  type PlaybackState,
} from "./useReelPlayback";

const reel: TravelReel = {
  tripId: "trip-one",
  scenes: [1, 2, 3].map((index) => ({
    id: `scene-${index}`,
    mediaId: `media-${index}`,
    durationMs: 3_000,
  })),
  excludedMediaIds: [],
  durationMs: 9_000,
  mode: "edited",
};

const playing: PlaybackState = {
  sceneIndex: 0,
  elapsedMs: 500,
  playing: true,
  controlsVisible: false,
  completed: false,
  resumePromptVisible: false,
};

describe("reel playback state", () => {
  it("shows controls without pausing on a canvas tap", () => {
    const next = playbackReducer(playing, { type: "SHOW_CONTROLS" });

    expect(next.playing).toBe(true);
    expect(next.controlsVisible).toBe(true);
  });

  it("resumes an interrupted session at the start of the saved scene", () => {
    expect(
      resumeFrom({ sceneId: "scene-3", completed: false }, reel)
    ).toEqual({ sceneIndex: 2, elapsedMs: 0 });
  });

  it("advances scenes and stops after the final photo", () => {
    const second = playbackReducer(playing, {
      type: "TICK",
      deltaMs: 2_500,
      durationMs: 3_000,
      sceneCount: 3,
    });
    const finalPlaying = { ...second, sceneIndex: 2, elapsedMs: 2_900 };
    const completed = playbackReducer(finalPlaying, {
      type: "TICK",
      deltaMs: 100,
      durationMs: 3_000,
      sceneCount: 3,
    });

    expect(second).toMatchObject({ sceneIndex: 1, elapsedMs: 0 });
    expect(completed).toMatchObject({
      sceneIndex: 2,
      playing: false,
      completed: true,
      controlsVisible: true,
    });
  });

  it("pauses when the page becomes hidden", () => {
    expect(playbackReducer(playing, { type: "VISIBILITY_PAUSE" }))
      .toMatchObject({
        elapsedMs: 0,
        playing: false,
        controlsVisible: true,
      });
  });
});
