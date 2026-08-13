import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TripMedia } from "../../../shared/media";
import { ReelEditor } from "./ReelEditor";
import type { TravelReel } from "./types";

function photo(index: number): TripMedia {
  return {
    id: `media-${index}`,
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
    aiScore: 0.8 - index * 0.1,
    aiLabels: ["harbor"],
    createdBy: "owner",
    createdAt: new Date(Date.UTC(2026, 6, index)).toISOString(),
  };
}

describe("ReelEditor", () => {
  it("renders the saved reel before slow thumbnail cache reads finish", async () => {
    const saved: TravelReel = {
      tripId: "trip-one",
      scenes: [{ id: "scene-1", mediaId: "media-1", durationMs: 3_000 }],
      excludedMediaIds: [],
      durationMs: 3_000,
      mode: "edited",
    };
    const store = {
      get: vi.fn().mockResolvedValue(saved),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const thumbnailStore = {
      get: vi.fn().mockReturnValue(new Promise<Blob | null>(() => undefined)),
      remove: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <ReelEditor
        media={[photo(1)]}
        store={store}
        thumbnailStore={thumbnailStore}
        tripId="trip-one"
      />
    );

    expect((await screen.findAllByText("0:03")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "미리보기 재생" })).toBeEnabled();
  });

  it("downloads Drive previews concurrently and reveals the first completed image", async () => {
    const user = userEvent.setup();
    const photos = [photo(1), photo(2), photo(3), photo(4), photo(5)];
    const store = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const thumbnailStore = {
      get: vi.fn().mockResolvedValue(null),
      remove: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const downloads = photos.map(() => deferred<Blob>());
    const provider = {
      provider: "google-drive" as const,
      connected: true,
      connect: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn().mockResolvedValue({ id: "folder" }),
      upload: vi.fn().mockResolvedValue({ id: "uploaded" }),
      download: vi.fn((objectId: string) => {
        const index = photos.findIndex((item) => item.thumbnailObjectId === objectId);
        return downloads[index]!.promise;
      }),
      remove: vi.fn().mockResolvedValue(undefined),
      folderUrl: vi.fn().mockReturnValue("#"),
    };
    let objectUrlIndex = 0;
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => `blob:preview-${objectUrlIndex += 1}`),
      revokeObjectURL: vi.fn(),
    });

    render(
      <ReelEditor
        media={photos}
        provider={provider}
        store={store}
        thumbnailStore={thumbnailStore}
        tripId="trip-one"
      />
    );

    await screen.findByText("0:15");
    await user.click(screen.getByRole("button", { name: "Drive 미리보기 새로 불러오기" }));
    await waitFor(() => expect(provider.download).toHaveBeenCalledTimes(4));
    expect(provider.download).not.toHaveBeenCalledWith(photos[4]!.thumbnailObjectId);

    downloads[0]!.resolve(new Blob(["first"], { type: "image/webp" }));
    expect(await screen.findByRole("img", { name: "1번째 릴 사진" })).toBeVisible();
  });

  it("edits, replaces, undoes, and saves a photo-only silent reel", async () => {
    const user = userEvent.setup();
    const store = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <ReelEditor
        media={[photo(1), photo(2), photo(3)]}
        store={store}
        tripId="trip-one"
      />
    );

    expect(await screen.findByText("0:09")).toBeVisible();
    expect(screen.getByText("사진만 사용 · 음악 없음 · 앱 안에서 미리보기")).toBeVisible();

    const excludeButtons = screen.getAllByRole("button", { name: "제외" });
    await user.click(excludeButtons[1] as HTMLButtonElement);
    expect(await screen.findByText("제외 사진 1장")).toBeVisible();
    expect(screen.getByText("0:06")).toBeVisible();

    const replaceButtons = screen.getAllByRole("button", { name: "교체" });
    await user.click(replaceButtons[0] as HTMLButtonElement);
    await user.click(screen.getByRole("button", { name: "photo-2.jpg로 교체" }));
    expect(await screen.findByText("사진을 같은 위치에서 교체했습니다.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "실행 취소" }));
    expect(await screen.findByText("마지막 편집을 취소했습니다.")).toBeVisible();

    await waitFor(() => expect(store.save).toHaveBeenCalledTimes(4));
    expect(screen.queryByText(/MP4/)).not.toBeInTheDocument();
  });

  it("keeps unavailable Drive photos editable with placeholders", async () => {
    const store = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <ReelEditor media={[photo(1)]} store={store} tripId="trip-one" />
    );

    expect(await screen.findByText("Drive 연결 후 사진 미리보기")).toBeVisible();
    expect(screen.getByRole("button", { name: "미리보기 재생" })).toBeEnabled();
  });

  it("deletes only the app history after confirmation and preserves the Drive files", async () => {
    const user = userEvent.setup();
    const first = photo(1);
    const excluded = photo(2);
    const saved: TravelReel = {
      tripId: "trip-one",
      scenes: [{ id: "scene-1", mediaId: first.id, durationMs: 3_000 }],
      excludedMediaIds: [excluded.id],
      durationMs: 3_000,
      mode: "edited",
    };
    const store = {
      get: vi.fn().mockResolvedValue(saved),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const api = { remove: vi.fn().mockResolvedValue(undefined) };
    const thumbnailStore = {
      get: vi.fn().mockResolvedValue(null),
      remove: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const provider = {
      provider: "google-drive" as const,
      connected: true,
      connect: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn().mockResolvedValue({ id: "folder" }),
      upload: vi.fn().mockResolvedValue({ id: "uploaded" }),
      download: vi.fn().mockResolvedValue(new Blob()),
      remove: vi.fn().mockResolvedValue(undefined),
      folderUrl: vi.fn().mockReturnValue("#"),
    };
    const onMediaChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <ReelEditor
        api={api}
        media={[first, excluded]}
        onMediaChanged={onMediaChanged}
        provider={provider}
        store={store}
        thumbnailStore={thumbnailStore}
        tripId="trip-one"
      />
    );

    expect(await screen.findByText("제외 사진 1장")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "photo-2.jpg 이력 삭제" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Google Drive 원본과 미리보기 파일은 유지합니다."
    );
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(api.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "photo-2.jpg 이력 삭제" }));
    await user.click(screen.getByRole("button", { name: "이력 삭제 확인" }));

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("trip-one", excluded.id));
    expect(thumbnailStore.remove).toHaveBeenCalledWith(excluded.id);
    expect(provider.remove).not.toHaveBeenCalled();
    expect(store.save).toHaveBeenLastCalledWith(expect.objectContaining({
      scenes: [expect.objectContaining({ mediaId: first.id })],
      excludedMediaIds: [],
    }));
    expect(onMediaChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("photo-2.jpg")).not.toBeInTheDocument();
    expect(screen.getByText(/사진 이력을 삭제했습니다.*Google Drive 원본/)).toBeVisible();
  });

  it("keeps the photo history visible when the app record cannot be deleted", async () => {
    const user = userEvent.setup();
    const first = photo(1);
    const excluded = photo(2);
    const saved: TravelReel = {
      tripId: "trip-one",
      scenes: [{ id: "scene-1", mediaId: first.id, durationMs: 3_000 }],
      excludedMediaIds: [excluded.id],
      durationMs: 3_000,
      mode: "edited",
    };
    const store = {
      get: vi.fn().mockResolvedValue(saved),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const api = { remove: vi.fn().mockRejectedValue(new Error("request failed")) };
    const onMediaChanged = vi.fn().mockResolvedValue(undefined);

    render(
      <ReelEditor
        api={api}
        media={[first, excluded]}
        onMediaChanged={onMediaChanged}
        store={store}
        tripId="trip-one"
      />
    );

    expect(await screen.findByText("제외 사진 1장")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "photo-2.jpg 이력 삭제" }));
    await user.click(screen.getByRole("button", { name: "이력 삭제 확인" }));

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("trip-one", excluded.id));
    expect(onMediaChanged).not.toHaveBeenCalled();
    expect(screen.getByText("photo-2.jpg")).toBeVisible();
    expect(screen.getByText("사진 이력을 삭제하지 못했습니다. 다시 시도해 주세요.")).toBeVisible();
  });

  it("retries local cleanup after the app history is deleted", async () => {
    const user = userEvent.setup();
    const first = photo(1);
    const excluded = photo(2);
    const saved: TravelReel = {
      tripId: "trip-one",
      scenes: [{ id: "scene-1", mediaId: first.id, durationMs: 3_000 }],
      excludedMediaIds: [excluded.id],
      durationMs: 3_000,
      mode: "edited",
    };
    const store = {
      get: vi.fn().mockResolvedValue(saved),
      save: vi.fn()
        .mockRejectedValueOnce(new Error("temporary reel store failure"))
        .mockResolvedValue(undefined),
    };
    const thumbnailStore = {
      get: vi.fn().mockResolvedValue(null),
      remove: vi.fn()
        .mockRejectedValueOnce(new Error("temporary thumbnail store failure"))
        .mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <ReelEditor
        api={{ remove: vi.fn().mockResolvedValue(undefined) }}
        media={[first, excluded]}
        store={store}
        thumbnailStore={thumbnailStore}
        tripId="trip-one"
      />
    );

    expect(await screen.findByText("제외 사진 1장")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "photo-2.jpg 이력 삭제" }));
    await user.click(screen.getByRole("button", { name: "이력 삭제 확인" }));

    await waitFor(() => expect(store.save.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(thumbnailStore.remove).toHaveBeenCalledTimes(2);
    expect(store.save).toHaveBeenLastCalledWith(expect.objectContaining({
      excludedMediaIds: [],
    }));
    expect(screen.getByText(/사진 이력을 삭제했습니다.*Google Drive 원본/)).toBeVisible();
  });

  it("persists reconciled reel references when deleted media is missing on reload", async () => {
    const first = photo(1);
    const removed = photo(2);
    const saved: TravelReel = {
      tripId: "trip-one",
      scenes: [{ id: "scene-1", mediaId: first.id, durationMs: 3_000 }],
      excludedMediaIds: [removed.id],
      durationMs: 3_000,
      mode: "edited",
    };
    const store = {
      get: vi.fn().mockResolvedValue(saved),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <ReelEditor media={[first]} store={store} tripId="trip-one" />
    );

    await waitFor(() => expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
      excludedMediaIds: [],
      scenes: [expect.objectContaining({ mediaId: first.id })],
    })));
    expect(screen.queryByText("photo-2.jpg")).not.toBeInTheDocument();
  });
});

function deferred<T>() {
  // eslint-disable-next-line no-unused-vars
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
