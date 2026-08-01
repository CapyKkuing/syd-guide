/* eslint-disable no-unused-vars */
import type { MemberRole } from "../../shared/entities";
import type {
  BookingDocument,
  BookingDocumentMimeType,
  TripBookingStorage,
} from "../../shared/media";
import type { MediaApi } from "./api";
import type { MediaStorageProviderClient } from "./provider";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const SUPPORTED_TYPES = new Set<BookingDocumentMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export interface BookingDocumentRuntime {
  upload(file: File): Promise<BookingDocument>;
  download(document: BookingDocument): Promise<Blob>;
  remove(document: BookingDocument): Promise<void>;
}

export function createBookingDocumentRuntime({
  api,
  provider,
  tripId,
  viewerRole,
}: {
  api: Pick<
    MediaApi,
    "getConfig" | "getBookingStorage" | "saveBookingStorage"
  >;
  provider: MediaStorageProviderClient;
  tripId: string;
  viewerRole: MemberRole;
}): BookingDocumentRuntime {
  let cachedStorage: TripBookingStorage | null | undefined;

  async function connect(): Promise<void> {
    if (provider.connected) return;
    const config = await api.getConfig(tripId);
    if (!config.clientId) {
      throw new Error(
        "Google OAuth client ID가 아직 설정되지 않았습니다. 관리자 설정을 확인해 주세요."
      );
    }
    await provider.connect(config.clientId);
  }

  async function storage(): Promise<TripBookingStorage> {
    await connect();
    cachedStorage ??= await api.getBookingStorage(tripId);
    if (cachedStorage) return cachedStorage;
    if (viewerRole !== "owner") {
      throw new Error("여행 대표자가 먼저 예약 파일 폴더를 만들어야 합니다.");
    }
    const reservations = await provider.createFolder("Reservations");
    const tripFolder = await provider.createFolder(tripId, reservations.id);
    cachedStorage = await api.saveBookingStorage(tripId, tripFolder.id);
    return cachedStorage;
  }

  return {
    async upload(file) {
      validate(file);
      const target = await storage();
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const uploaded = await provider.upload(
        target.rootObjectId,
        `${Date.now()}-${crypto.randomUUID()}-${safeName}`,
        file
      );
      return {
        provider: provider.provider,
        providerObjectId: uploaded.id,
        originalName: file.name,
        mimeType: file.type as BookingDocumentMimeType,
      };
    },
    async download(document) {
      await connect();
      return provider.download(document.providerObjectId);
    },
    async remove(document) {
      await connect();
      await provider.remove(document.providerObjectId);
    },
  };
}

function validate(file: File): void {
  if (!SUPPORTED_TYPES.has(file.type as BookingDocumentMimeType)) {
    throw new Error("JPG, PNG, WebP 또는 PDF 파일만 첨부할 수 있습니다.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("예약 파일은 25MB 이하여야 합니다.");
  }
}
