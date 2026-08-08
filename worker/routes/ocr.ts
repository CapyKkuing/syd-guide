import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppDependencies } from "../auth/access";
import { requirePrincipal } from "../auth/principal";
import { reserveVisionOcrPages, VISION_OCR_PAGE_LIMIT } from "../db/vision-ocr";
import { findTripForMember } from "../db/trips";
import type { AppEnv } from "../env";
import {
  analyzeBookingDocument,
  GoogleVisionProviderError,
  type GoogleVisionConfig,
  type GoogleVisionFetch,
  type VisionTokenProvider,
} from "../services/google-vision";

export class OcrError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const maxOcrBytes = 7 * 1024 * 1024;

export function registerOcrRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies,
  visionFetch: GoogleVisionFetch = fetch,
  tokenProvider?: VisionTokenProvider
) {
  app.post("/api/trips/:id/ocr/booking", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    const trip = await findTripForMember(c.env, tripId, principal.memberId);
    if (!trip || trip.deletedAt) {
      throw new OcrError(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
    }
    const config = configuredVision(c.env);
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || !acceptedTypes.has(file.type) || file.size > maxOcrBytes) {
      throw new OcrError(
        400,
        "OCR_FILE_INVALID",
        "OCR은 7MB 이하 JPG, PNG, WebP, PDF 파일만 사용할 수 있습니다. 직접 입력은 계속 가능합니다."
      );
    }
    const pages = file.type === "application/pdf" ? 5 : 1;
    const used = await reserveVisionOcrPages(c.env, pages, dependencies.now());
    if (used === null) {
      throw new OcrError(
        429,
        "OCR_FREE_LIMIT_REACHED",
        "이번 달 OCR 무료 보호 한도에 도달했습니다. 직접 입력해 주세요."
      );
    }
    try {
      const result = await analyzeBookingDocument(
        config,
        file,
        visionFetch,
        tokenProvider
      );
      c.header("Cache-Control", "private, no-store");
      return c.json({
        ...result,
        usage: { used, limit: VISION_OCR_PAGE_LIMIT },
      });
    } catch (error) {
      if (error instanceof GoogleVisionProviderError) {
        throw new OcrError(
          502,
          "OCR_PROVIDER_ERROR",
          "예약 정보를 자동 인식하지 못했습니다. 직접 입력해 주세요."
        );
      }
      throw error;
    }
  });
}

function configuredVision(env: AppEnv["Bindings"]): GoogleVisionConfig {
  if (
    !env.GOOGLE_VISION_CLIENT_EMAIL
    || !env.GOOGLE_VISION_PRIVATE_KEY
    || !env.GOOGLE_VISION_PROJECT_ID
  ) {
    throw new OcrError(
      503,
      "OCR_NOT_CONFIGURED",
      "OCR 연결 전입니다. 직접 입력은 계속 가능합니다."
    );
  }
  return {
    clientEmail: env.GOOGLE_VISION_CLIENT_EMAIL,
    privateKey: env.GOOGLE_VISION_PRIVATE_KEY,
    projectId: env.GOOGLE_VISION_PROJECT_ID,
  };
}
