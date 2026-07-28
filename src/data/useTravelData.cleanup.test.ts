import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TravelGuideDataSource } from "./contracts";

const lifecycle = vi.hoisted(() => ({
  setters: [] as ReturnType<typeof vi.fn>[],
  cleanup: undefined as undefined | (() => void)
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (initialValue: unknown | (() => unknown)) => {
      const value = typeof initialValue === "function" ? initialValue() : initialValue;
      const setter = vi.fn();
      lifecycle.setters.push(setter);
      return [value, setter];
    },
    useCallback: <T>(callback: T) => callback,
    useEffect: (effect: () => void | (() => void)) => {
      lifecycle.cleanup = effect() ?? undefined;
    }
  };
});

import { useTripWorkspace } from "./useTravelData";

function deferred<T>() {
  // ESLint's base no-unused-vars rule does not recognize function-type parameters.
  // eslint-disable-next-line no-unused-vars
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = (value) => resolvePromise(value);
  });
  return { promise, resolve };
}

describe("trip workspace cleanup", () => {
  beforeEach(() => {
    lifecycle.setters.length = 0;
    lifecycle.cleanup = undefined;
  });

  it("does not invoke the resource state setter when a pending request settles after cleanup", async () => {
    const context = deferred<null>();
    const dataSource: TravelGuideDataSource = {
      listTrips: async () => [],
      getTripContext: () => context.promise,
      getToday: async () => null,
      getSchedule: async () => null,
      getMapPreview: async () => null,
      getTools: async () => null
    };

    useTripWorkspace(dataSource, "sydney-2026");
    lifecycle.cleanup?.();
    context.resolve(null);
    await Promise.resolve();
    await Promise.resolve();

    expect(lifecycle.setters).toHaveLength(2);
    expect(lifecycle.setters[1]).not.toHaveBeenCalled();
  });
});
