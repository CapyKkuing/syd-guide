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
    capturedAt: null,
    aiScore: 0.91,
    aiLabels: ["harbor"],
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
    saveStorage: vi.fn().mockResolvedValue(storage),
    register: vi.fn().mockResolvedValue(savedMedia),
    selectRepresentative: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const provider: MediaStorageProviderClient & { connected: boolean } = {
    provider: "google-drive",
    connected: false,
    connect: vi.fn(async () => {
      provider.connected = true;
    }),
    createFolder: vi.fn().mockResolvedValue({ id: storage.rootObjectId }),
    upload: vi.fn()
      .mockResolvedValueOnce({ id: savedMedia.providerObjectId })
      .mockResolvedValueOnce({ id: savedMedia.thumbnailObjectId }),
    download: vi.fn().mockResolvedValue(new Blob(["thumb"], { type: "image/webp" })),
    remove: vi.fn().mockResolvedValue(undefined),
    folderUrl: vi.fn().mockReturnValue("https://drive.google.com/drive/folders/folder_12345"),
  };
  const thumbnailStore = {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const ranker = vi.fn().mockResolvedValue([{
    file: new File(["photo"], "harbour.jpg", { type: "image/jpeg" }),
    thumbnail: new Blob(["thumb"], { type: "image/webp" }),
    width: 1600,
    height: 900,
    capturedAt: null,
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
    expect(runtime.api.register).toHaveBeenCalledWith(
      trip.id,
      expect.objectContaining({
        providerObjectId: runtime.savedMedia.providerObjectId,
        thumbnailObjectId: runtime.savedMedia.thumbnailObjectId,
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
});
