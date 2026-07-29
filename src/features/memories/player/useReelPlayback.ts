import { useEffect, useReducer } from "react";
import type { TravelReel } from "../reel/types";

export interface PlaybackCheckpoint {
  sceneId: string;
  completed: boolean;
}

export interface PlaybackState {
  sceneIndex: number;
  elapsedMs: number;
  playing: boolean;
  controlsVisible: boolean;
  completed: boolean;
  resumePromptVisible: boolean;
}

type PlaybackAction =
  | { type: "SHOW_CONTROLS" }
  | { type: "HIDE_CONTROLS" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "PREVIOUS_SCENE" }
  | { type: "NEXT_SCENE"; sceneCount: number }
  | { type: "TICK"; deltaMs: number; durationMs: number; sceneCount: number }
  | { type: "VISIBILITY_PAUSE" }
  | { type: "RESUME" }
  | { type: "RESTART" };

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction
): PlaybackState {
  switch (action.type) {
    case "SHOW_CONTROLS":
      return { ...state, controlsVisible: true };
    case "HIDE_CONTROLS":
      return state.playing
        ? { ...state, controlsVisible: false }
        : state;
    case "TOGGLE_PAUSE":
      return state.completed
        ? state
        : {
            ...state,
            playing: !state.playing,
            controlsVisible: true,
          };
    case "PREVIOUS_SCENE":
      return {
        ...state,
        sceneIndex: Math.max(0, state.sceneIndex - 1),
        elapsedMs: 0,
        completed: false,
      };
    case "NEXT_SCENE":
      return {
        ...state,
        sceneIndex: Math.min(
          Math.max(action.sceneCount - 1, 0),
          state.sceneIndex + 1
        ),
        elapsedMs: 0,
        completed: false,
      };
    case "TICK": {
      if (!state.playing || state.completed) return state;
      const elapsedMs = state.elapsedMs + action.deltaMs;
      if (elapsedMs < action.durationMs) {
        return { ...state, elapsedMs };
      }
      if (state.sceneIndex >= action.sceneCount - 1) {
        return {
          ...state,
          elapsedMs: action.durationMs,
          playing: false,
          controlsVisible: true,
          completed: true,
        };
      }
      return {
        ...state,
        sceneIndex: state.sceneIndex + 1,
        elapsedMs: 0,
      };
    }
    case "VISIBILITY_PAUSE":
      return {
        ...state,
        elapsedMs: 0,
        playing: false,
        controlsVisible: true,
      };
    case "RESUME":
      return {
        ...state,
        playing: true,
        controlsVisible: false,
        resumePromptVisible: false,
      };
    case "RESTART":
      return {
        sceneIndex: 0,
        elapsedMs: 0,
        playing: true,
        controlsVisible: false,
        completed: false,
        resumePromptVisible: false,
      };
  }
}

export function resumeFrom(
  checkpoint: PlaybackCheckpoint,
  reel: TravelReel
): Pick<PlaybackState, "sceneIndex" | "elapsedMs"> {
  const sceneIndex = reel.scenes.findIndex(
    (scene) => scene.id === checkpoint.sceneId
  );
  return {
    sceneIndex: Math.max(sceneIndex, 0),
    elapsedMs: 0,
  };
}

export function useReelPlayback(reel: TravelReel, tripId: string) {
  const [state, dispatch] = useReducer(
    playbackReducer,
    { reel, tripId },
    ({ reel: initialReel, tripId: initialTripId }): PlaybackState => {
      const checkpoint = readPlaybackCheckpoint(initialTripId);
      if (checkpoint && !checkpoint.completed) {
        return {
          ...resumeFrom(checkpoint, initialReel),
          playing: false,
          controlsVisible: true,
          completed: false,
          resumePromptVisible: true,
        };
      }
      return {
        sceneIndex: 0,
        elapsedMs: 0,
        playing: initialReel.scenes.length > 0,
        controlsVisible: initialReel.scenes.length === 0,
        completed: false,
        resumePromptVisible: false,
      };
    }
  );
  const scene = reel.scenes[state.sceneIndex];

  useEffect(() => {
    if (!state.playing || !scene) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const current = performance.now();
      dispatch({
        type: "TICK",
        deltaMs: current - previous,
        durationMs: scene.durationMs,
        sceneCount: reel.scenes.length,
      });
      previous = current;
    }, 50);
    return () => window.clearInterval(timer);
  }, [reel.scenes.length, scene, state.playing]);

  useEffect(() => {
    if (!state.controlsVisible || !state.playing || state.resumePromptVisible) {
      return;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "HIDE_CONTROLS" }),
      2_500
    );
    return () => window.clearTimeout(timer);
  }, [state.controlsVisible, state.playing, state.resumePromptVisible]);

  useEffect(() => {
    if (!scene) return;
    writePlaybackCheckpoint(tripId, {
      sceneId: scene.id,
      completed: state.completed,
    });
  }, [scene, state.completed, tripId]);

  useEffect(() => {
    if (!scene) return;
    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      writePlaybackCheckpoint(tripId, {
        sceneId: scene.id,
        completed: state.completed,
      });
      dispatch({ type: "VISIBILITY_PAUSE" });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [scene, state.completed, tripId]);

  return {
    state,
    scene,
    progress: scene
      ? Math.min(state.elapsedMs / scene.durationMs, 1)
      : 0,
    showControls: () => dispatch({ type: "SHOW_CONTROLS" }),
    togglePause: () => dispatch({ type: "TOGGLE_PAUSE" }),
    previous: () => dispatch({ type: "PREVIOUS_SCENE" }),
    next: () =>
      dispatch({ type: "NEXT_SCENE", sceneCount: reel.scenes.length }),
    resume: () => dispatch({ type: "RESUME" }),
    restart: () => dispatch({ type: "RESTART" }),
  };
}

function checkpointKey(tripId: string): string {
  return `travel-reel-checkpoint:${tripId}`;
}

function readPlaybackCheckpoint(tripId: string): PlaybackCheckpoint | null {
  try {
    const raw = sessionStorage.getItem(checkpointKey(tripId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !value
      || typeof value !== "object"
      || !("sceneId" in value)
      || typeof value.sceneId !== "string"
      || !("completed" in value)
      || typeof value.completed !== "boolean"
    ) {
      return null;
    }
    return {
      sceneId: value.sceneId,
      completed: value.completed,
    };
  } catch {
    return null;
  }
}

function writePlaybackCheckpoint(
  tripId: string,
  checkpoint: PlaybackCheckpoint
): void {
  try {
    sessionStorage.setItem(checkpointKey(tripId), JSON.stringify(checkpoint));
  } catch {
    return;
  }
}
