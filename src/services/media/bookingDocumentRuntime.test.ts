import { describe, expect, it, vi } from "vitest";
import { createBookingDocumentRuntime } from "./bookingDocumentRuntime";

describe("booking document runtime", () => {
  it("creates Reservations/trip-id once and uploads the selected file", async () => {
    const api = {
      getConfig: vi.fn().mockResolvedValue({
        provider: "google-drive",
        clientId: "client-id",
      }),
      getBookingStorage: vi.fn().mockResolvedValue(null),
      saveBookingStorage: vi.fn().mockImplementation(
        async (tripId: string, rootObjectId: string) => ({
          tripId,
          provider: "google-drive" as const,
          rootObjectId,
          connectedBy: "owner",
          connectedAt: "2026-08-02T00:00:00.000Z",
        })
      ),
    };
    const provider = {
      provider: "google-drive" as const,
      connected: false,
      connect: vi.fn().mockResolvedValue(undefined),
      createFolder: vi.fn()
        .mockResolvedValueOnce({ id: "reservations-root" })
        .mockResolvedValueOnce({ id: "trip-folder" }),
      upload: vi.fn().mockResolvedValue({ id: "document-id" }),
      download: vi.fn(),
      remove: vi.fn(),
      folderUrl: vi.fn(),
    };
    const runtime = createBookingDocumentRuntime({
      api,
      provider,
      tripId: "sydney-2026",
      viewerRole: "owner",
    });
    const file = new File(["voucher"], "voucher.pdf", {
      type: "application/pdf",
    });

    await expect(runtime.upload(file)).resolves.toEqual({
      provider: "google-drive",
      providerObjectId: "document-id",
      originalName: "voucher.pdf",
      mimeType: "application/pdf",
    });
    expect(provider.createFolder).toHaveBeenNthCalledWith(1, "Reservations");
    expect(provider.createFolder).toHaveBeenNthCalledWith(
      2,
      "sydney-2026",
      "reservations-root"
    );
    expect(api.saveBookingStorage).toHaveBeenCalledWith(
      "sydney-2026",
      "trip-folder"
    );
    expect(provider.upload).toHaveBeenCalledWith(
      "trip-folder",
      expect.stringMatching(/voucher\.pdf$/),
      file
    );
  });

  it("requires the owner to create the booking folder first", async () => {
    const runtime = createBookingDocumentRuntime({
      api: {
        getConfig: vi.fn().mockResolvedValue({
          provider: "google-drive",
          clientId: "client-id",
        }),
        getBookingStorage: vi.fn().mockResolvedValue(null),
        saveBookingStorage: vi.fn(),
      },
      provider: {
        provider: "google-drive" as const,
        connected: false,
        connect: vi.fn().mockResolvedValue(undefined),
        createFolder: vi.fn(),
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn(),
        folderUrl: vi.fn(),
      },
      tripId: "sydney-2026",
      viewerRole: "partner",
    });

    await expect(runtime.upload(new File(["x"], "voucher.jpg", {
      type: "image/jpeg",
    }))).rejects.toThrow("여행 대표자가 먼저 예약 파일 폴더를 만들어야 합니다.");
  });
});
