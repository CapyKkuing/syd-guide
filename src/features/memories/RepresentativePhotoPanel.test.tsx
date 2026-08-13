import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TripSummaryViewModel } from "../../data/contracts";
import type { TripMedia, TripMediaStorage } from "../../shared/media";
import type { MediaApi } from "../../services/media/api";
import type { MediaStorageProviderClient } from "../../services/media/provider";
import { RepresentativePhotoPanel } from "./RepresentativePhotoPanel";

const trip: TripSummaryViewModel = {
  id: "trip-one",
  title: "시드니 여행",
  country: "Australia",
  destination: "Sydney",
  startDate: "2026-07-01",
  endDate: "2026-07-05",
  timeZone: "Australia/Sydney",
  phase: "completed",
  experiencePhase: "after",
  coverImageUrl: "/images/sydney_harbour_bridge.jpg",
  travelerCount: 2,
  bookingCount: 2,
  hasOutboundFlight: true,
  hasReturnFlight: true,
  representativeMediaId: null,
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const storage: TripMediaStorage = {
  tripId: trip.id,
  provider: "google-drive",
  rootObjectId: "folder_12345",
  connectedBy: "owner",
  connectedAt: "2026-07-29T00:00:00.000Z",
};
const previewFolder = { id: "preview_folder_12345" };

function media(): TripMedia {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tripId: trip.id,
    kind: "photo",
    provider: "google-drive",
    providerObjectId: "original_12345",
    thumbnailObjectId: "thumb_12345",
    originalName: "harbour.jpg",
    mimeType: "image/jpeg",
    width: 1600,
    height: 900,
    capturedAt: "2026-08-02T09:20:00+10:00",
    aiScore: 0.91,
    aiLabels: ["harbor"],
    previewCropAspect: "4:3",
    previewBrightness: 0,
    createdBy: "owner",
    createdAt: "2026-07-29T00:00:00.000Z",
  };
}

function setup(clientId: string | null = "test-client-id") {
  const savedMedia = media();
  const api: MediaApi = {
    getConfig: vi.fn().mockResolvedValue({
      provider: "google-drive",
      clientId,
    }),
    getBookingStorage: vi.fn().mockResolvedValue(null),
    saveBookingStorage: vi.fn(),
    saveStorage: vi.fn().mockResolvedValue(storage),
    register: vi.fn().mockResolvedValue(savedMedia),
    selectRepresentative: vi.fn().mockResolvedValue(undefined),
    savePreview: vi.fn().mockResolvedValue(savedMedia),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const provider: MediaStorageProviderClient & { connected: boolean } = {
    provider: "google-drive",
    connected: false,
    connect: vi.fn(async () => {
      provider.connected = true;
    }),
    createFolder: vi.fn().mockResolvedValue({ id: storage.rootObjectId }),
    findFolder: vi.fn().mockResolvedValue(previewFolder),
    upload: vi.fn()
      .mockResolvedValueOnce({ id: savedMedia.providerObjectId })
      .mockResolvedValueOnce({ id: savedMedia.thumbnailObjectId }),
    download: vi.fn().mockResolvedValue(new Blob(["thumb"], { type: "image/webp" })),
    remove: vi.fn().mockResolvedValue(undefined),
    folderUrl: vi.fn().mockReturnValue("https://drive.google.com/drive/folders/folder_12345"),
  };
  const thumbnailStore = {
    get: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const ranker = vi.fn().mockResolvedValue([{
    file: new File(["photo"], "harbour.jpg", { type: "image/jpeg" }),
    thumbnail: new Blob(["thumb"], { type: "image/webp" }),
    width: 1600,
    height: 900,
    capturedAt: "2026-08-02T09:20:00+10:00",
    score: 0.91,
    labels: ["harbor"],
  }]);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn().mockReturnValue("blob:preview"),
    revokeObjectURL: vi.fn(),
  });
  return { api, provider, ranker, savedMedia, thumbnailStore };
}

describe("RepresentativePhotoPanel", () => {
  it("connects Drive, uploads a locally ranked photo, and saves the representative", async () => {
    const user = userEvent.setup();
    const runtime = setup();
    const { container } = render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        ranker={runtime.ranker}
        storage={null}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );

    await user.click(screen.getByRole("button", { name: "Google Drive 연결" }));
    expect(runtime.api.saveStorage).toHaveBeenCalledWith(trip.id, storage.rootObjectId);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input missing");
    const file = new File(["photo"], "harbour.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("추천 91점");
    expect(runtime.ranker).toHaveBeenCalledWith([file]);
    expect(runtime.provider.findFolder).toHaveBeenCalledWith(
      "앱 미리보기",
      storage.rootObjectId
    );
    expect(runtime.provider.upload).toHaveBeenNthCalledWith(
      1,
      storage.rootObjectId,
      expect.stringContaining("-harbour.jpg"),
      expect.any(File)
    );
    expect(runtime.provider.upload).toHaveBeenNthCalledWith(
      2,
      previewFolder.id,
      expect.stringContaining("-thumb.webp"),
      expect.any(Blob)
    );
    expect(runtime.api.register).toHaveBeenCalledWith(
      trip.id,
      expect.objectContaining({
        providerObjectId: runtime.savedMedia.providerObjectId,
        thumbnailObjectId: runtime.savedMedia.thumbnailObjectId,
        capturedAt: "2026-08-02T09:20:00+10:00",
        aiScore: 0.91,
      })
    );

    await user.click(screen.getByRole("button", { name: "대표사진으로 선택" }));
    await waitFor(() => {
      expect(runtime.api.selectRepresentative).toHaveBeenCalledWith(
        trip.id,
        runtime.savedMedia.id
      );
    });
    expect(screen.getByRole("button", { name: "대표사진" })).toBeDisabled();
  });

  it("explains the missing OAuth configuration without creating a folder", async () => {
    const user = userEvent.setup();
    const runtime = setup(null);
    render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        storage={null}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );

    await user.click(screen.getByRole("button", { name: "Google Drive 연결" }));

    expect(await screen.findByText(/Google OAuth client ID가 아직 설정되지 않았습니다/)).toBeVisible();
    expect(runtime.provider.createFolder).not.toHaveBeenCalled();
  });

  it("reuses one preview folder for every photo in a multi-file upload", async () => {
    const runtime = setup();
    const secondMedia = {
      ...runtime.savedMedia,
      id: "22222222-2222-4222-8222-222222222222",
      providerObjectId: "original_67890",
      thumbnailObjectId: "thumb_67890",
      originalName: "opera-house.jpg",
    };
    const files = [
      new File(["photo-one"], "harbour.jpg", { type: "image/jpeg" }),
      new File(["photo-two"], "opera-house.jpg", { type: "image/jpeg" }),
    ];
    vi.mocked(runtime.ranker).mockResolvedValue([
      {
        file: files[0],
        thumbnail: new Blob(["thumb-one"], { type: "image/webp" }),
        width: 1600,
        height: 900,
        capturedAt: "2026-08-02T09:20:00+10:00",
        score: 0.91,
        labels: ["harbor"],
      },
      {
        file: files[1],
        thumbnail: new Blob(["thumb-two"], { type: "image/webp" }),
        width: 1200,
        height: 1600,
        capturedAt: "2026-08-03T11:30:00+10:00",
        score: 0.87,
        labels: ["landmark"],
      },
    ]);
    vi.mocked(runtime.provider.upload)
      .mockReset()
      .mockResolvedValueOnce({ id: runtime.savedMedia.providerObjectId })
      .mockResolvedValueOnce({ id: runtime.savedMedia.thumbnailObjectId })
      .mockResolvedValueOnce({ id: secondMedia.providerObjectId })
      .mockResolvedValueOnce({ id: secondMedia.thumbnailObjectId });
    vi.mocked(runtime.api.register)
      .mockResolvedValueOnce(runtime.savedMedia)
      .mockResolvedValueOnce(secondMedia);
    const { container } = render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        ranker={runtime.ranker}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input missing");
    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect(runtime.api.register).toHaveBeenCalledTimes(2));
    expect(runtime.provider.findFolder).toHaveBeenCalledTimes(1);
    expect(runtime.provider.createFolder).not.toHaveBeenCalled();
    expect(runtime.provider.upload).toHaveBeenNthCalledWith(
      1,
      storage.rootObjectId,
      expect.stringContaining("-harbour.jpg"),
      files[0]
    );
    expect(runtime.provider.upload).toHaveBeenNthCalledWith(
      2,
      previewFolder.id,
      expect.stringContaining("-thumb.webp"),
      expect.any(Blob)
    );
    expect(runtime.provider.upload).toHaveBeenNthCalledWith(
      3,
      storage.rootObjectId,
      expect.stringContaining("-opera-house.jpg"),
      files[1]
    );
    expect(runtime.provider.upload).toHaveBeenNthCalledWith(
      4,
      previewFolder.id,
      expect.stringContaining("-thumb.webp"),
      expect.any(Blob)
    );
  });

  it("keeps completed photos visible when a later photo upload fails", async () => {
    const runtime = setup();
    const files = [
      new File(["photo-one"], "harbour.jpg", { type: "image/jpeg" }),
      new File(["photo-two"], "opera-house.jpg", { type: "image/jpeg" }),
    ];
    vi.mocked(runtime.ranker).mockResolvedValue([
      {
        file: files[0],
        thumbnail: new Blob(["thumb-one"], { type: "image/webp" }),
        width: 1600,
        height: 900,
        capturedAt: "2026-08-02T09:20:00+10:00",
        score: 0.91,
        labels: ["harbor"],
      },
      {
        file: files[1],
        thumbnail: new Blob(["thumb-two"], { type: "image/webp" }),
        width: 1200,
        height: 1600,
        capturedAt: "2026-08-03T11:30:00+10:00",
        score: 0.87,
        labels: ["landmark"],
      },
    ]);
    vi.mocked(runtime.provider.upload)
      .mockReset()
      .mockResolvedValueOnce({ id: runtime.savedMedia.providerObjectId })
      .mockResolvedValueOnce({ id: runtime.savedMedia.thumbnailObjectId })
      .mockResolvedValueOnce({ id: "original_67890" })
      .mockRejectedValueOnce(new Error("두 번째 미리보기 업로드 실패"));
    const { container } = render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        ranker={runtime.ranker}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input missing");
    fireEvent.change(input, { target: { files } });

    expect(await screen.findByText("두 번째 미리보기 업로드 실패")).toBeVisible();
    expect(screen.getByText("추천 91점")).toBeVisible();
    expect(runtime.api.register).toHaveBeenCalledTimes(1);
    expect(runtime.provider.remove).toHaveBeenCalledWith("original_67890");
  });

  it("removes both Drive objects when media registration fails", async () => {
    const runtime = setup();
    vi.mocked(runtime.api.register).mockRejectedValue(new Error("미디어 등록 실패"));
    const { container } = render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        ranker={runtime.ranker}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input missing");
    fireEvent.change(input, {
      target: { files: [new File(["photo"], "harbour.jpg", { type: "image/jpeg" })] },
    });

    expect(await screen.findByText("미디어 등록 실패")).toBeVisible();
    expect(runtime.provider.remove).toHaveBeenCalledTimes(2);
    expect(runtime.provider.remove).toHaveBeenCalledWith(runtime.savedMedia.providerObjectId);
    expect(runtime.provider.remove).toHaveBeenCalledWith(runtime.savedMedia.thumbnailObjectId);
  });

  it("removes the registered media and Drive objects when thumbnail caching fails", async () => {
    const runtime = setup();
    vi.mocked(runtime.thumbnailStore.save).mockRejectedValue(
      new Error("기기 미리보기 저장 실패")
    );
    const { container } = render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        ranker={runtime.ranker}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input missing");
    fireEvent.change(input, {
      target: { files: [new File(["photo"], "harbour.jpg", { type: "image/jpeg" })] },
    });

    expect(await screen.findByText("기기 미리보기 저장 실패")).toBeVisible();
    expect(runtime.api.remove).toHaveBeenCalledWith(trip.id, runtime.savedMedia.id);
    expect(runtime.provider.remove).toHaveBeenCalledTimes(2);
    expect(runtime.provider.remove).toHaveBeenCalledWith(runtime.savedMedia.providerObjectId);
    expect(runtime.provider.remove).toHaveBeenCalledWith(runtime.savedMedia.thumbnailObjectId);
  });

  it("creates the preview folder when it does not exist", async () => {
    const runtime = setup();
    vi.mocked(runtime.provider.findFolder!).mockResolvedValue(null);
    vi.mocked(runtime.provider.createFolder).mockResolvedValue(previewFolder);
    const { container } = render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        ranker={runtime.ranker}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input missing");
    fireEvent.change(input, {
      target: { files: [new File(["photo"], "harbour.jpg", { type: "image/jpeg" })] },
    });

    await screen.findByText("추천 91점");
    expect(runtime.provider.createFolder).toHaveBeenCalledWith(
      "앱 미리보기",
      storage.rootObjectId
    );
    expect(runtime.provider.upload).toHaveBeenNthCalledWith(
      2,
      previewFolder.id,
      expect.stringContaining("-thumb.webp"),
      expect.any(Blob)
    );
  });

  it("saves only representative preview settings without reuploading the Drive original", async () => {
    const user = userEvent.setup();
    const runtime = setup();
    const { container } = render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        ranker={runtime.ranker}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={trip}
        viewerRole="owner"
      />
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input missing");
    fireEvent.change(input, {
      target: { files: [new File(["photo"], "harbour.jpg", { type: "image/jpeg" })] },
    });
    await screen.findByText("추천 91점");
    await user.click(screen.getByRole("button", { name: "대표사진으로 선택" }));
    await user.click(await screen.findByRole("button", { name: "대표사진 편집" }));
    await user.click(screen.getByRole("button", { name: "1:1" }));
    fireEvent.change(screen.getByLabelText("밝기"), { target: { value: "8" } });
    await user.click(screen.getByRole("button", { name: "미리보기 저장" }));

    await waitFor(() => {
      expect(runtime.api.savePreview).toHaveBeenCalledWith(trip.id, runtime.savedMedia.id, {
        previewCropAspect: "1:1",
        previewBrightness: 8,
      });
    });
    expect(runtime.provider.upload).toHaveBeenCalledTimes(2);
  });

  it("deletes the representative app history after confirmation and preserves Drive files", async () => {
    const user = userEvent.setup();
    const runtime = setup();
    const onChanged = vi.fn().mockResolvedValue(undefined);
    vi.mocked(runtime.thumbnailStore.get).mockResolvedValue(
      new Blob(["thumb"], { type: "image/webp" })
    );
    render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[runtime.savedMedia]}
        onChanged={onChanged}
        provider={runtime.provider}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={{ ...trip, representativeMediaId: runtime.savedMedia.id }}
        viewerRole="owner"
      />
    );

    await user.click(await screen.findByRole("button", { name: "대표사진 삭제" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Google Drive 원본과 미리보기 파일은 유지합니다."
    );
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(runtime.api.remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "대표사진 삭제" }));
    await user.click(screen.getByRole("button", { name: "앱 이력 삭제 확인" }));

    await waitFor(() => {
      expect(runtime.api.remove).toHaveBeenCalledWith(trip.id, runtime.savedMedia.id);
    });
    expect(runtime.thumbnailStore.remove).toHaveBeenCalledWith(runtime.savedMedia.id);
    expect(runtime.provider.remove).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "대표사진 삭제" })).not.toBeInTheDocument();
    expect(screen.getByText(/대표사진 이력을 삭제했습니다.*Google Drive 원본/)).toBeVisible();
  });

  it("keeps the representative visible when app history deletion fails", async () => {
    const user = userEvent.setup();
    const runtime = setup();
    vi.mocked(runtime.thumbnailStore.get).mockResolvedValue(
      new Blob(["thumb"], { type: "image/webp" })
    );
    vi.mocked(runtime.api.remove).mockRejectedValue(new Error("request failed"));
    render(
      <RepresentativePhotoPanel
        api={runtime.api}
        media={[runtime.savedMedia]}
        onChanged={vi.fn()}
        provider={runtime.provider}
        storage={storage}
        thumbnailStore={runtime.thumbnailStore}
        trip={{ ...trip, representativeMediaId: runtime.savedMedia.id }}
        viewerRole="owner"
      />
    );

    await user.click(await screen.findByRole("button", { name: "대표사진 삭제" }));
    await user.click(screen.getByRole("button", { name: "앱 이력 삭제 확인" }));

    expect(await screen.findByText("대표사진 이력을 삭제하지 못했습니다. 다시 시도해 주세요.")).toBeVisible();
    expect(screen.getByRole("button", { name: "대표사진 삭제" })).toBeVisible();
    expect(runtime.thumbnailStore.remove).not.toHaveBeenCalled();
  });
});
