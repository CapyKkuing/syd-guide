import type { BookingOcrResult } from "../../shared/ocr";
import { requestWithAdminAccessRecovery } from "../../features/auth/api";
import { errorFromResponse } from "../api/errors";

type Fetcher = typeof fetch;

export class OcrApiClient {
  private readonly fetcher: Fetcher;
  private readonly baseUrl: string;

  constructor(fetcher: Fetcher = fetch, baseUrl = window.location.origin) {
    this.fetcher = fetcher.bind(globalThis);
    this.baseUrl = baseUrl;
  }

  async bookingDraft(tripId: string, file: File): Promise<BookingOcrResult> {
    const form = new FormData();
    form.set("file", file);
    const headers = new Headers();
    const hostname = new URL(this.baseUrl).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      headers.set(
        "X-Dev-Principal",
        localStorage.getItem("couple_dev_principal") === "partner" ? "partner" : "owner"
      );
    }
    const response = await requestWithAdminAccessRecovery(
      this.fetcher,
      new URL(`/api/trips/${encodeURIComponent(tripId)}/ocr/booking`, this.baseUrl),
      {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: form,
      },
      this.baseUrl
    );
    if (!response.ok) throw await errorFromResponse(response);
    return response.json() as Promise<BookingOcrResult>;
  }
}

export const ocrApiClient = new OcrApiClient();
