import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  classify: vi.fn(),
  createImageClassifier: vi.fn(),
  readExifCapturedAt: vi.fn(),
}));

vi.mock("./exifCapturedAt", () => ({
  readExifCapturedAt: mocks.readExifCapturedAt,
}));

vi.mock("./transformersRuntime.js", () => ({
  createImageClassifier: mocks.createImageClassifier,
}));

import { rankPhotos } from "./localPhotoRanker";

describe("rankPhotos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the EXIF capture time in the ranked upload metadata", async () => {
    const capturedAt = "2026-08-09T20:55:15+10:00";
    const file = new File(["jpeg"], "android-camera.jpg", { type: "image/jpeg" });
    const bitmap = {
      close: vi.fn(),
      height: 3000,
      width: 4000,
    } as unknown as ImageBitmap;
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(96 * 96 * 4),
      })),
    } as unknown as CanvasRenderingContext2D;

    mocks.readExifCapturedAt.mockResolvedValue(capturedAt);
    mocks.classify.mockResolvedValue([{ label: "bridge", score: 0.9 }]);
    mocks.createImageClassifier.mockResolvedValue(mocks.classify);
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["thumbnail"], { type: "image/webp" }));
    });

    const [ranked] = await rankPhotos([file]);

    expect(ranked).toMatchObject({
      capturedAt,
      file,
      height: 3000,
      labels: ["bridge"],
      width: 4000,
    });
    expect(ranked?.thumbnail.type).toBe("image/webp");
    expect(mocks.readExifCapturedAt).toHaveBeenCalledWith(file);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
