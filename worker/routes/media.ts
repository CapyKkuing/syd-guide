import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import type { AppDependencies } from "../auth/access";
import { requirePrincipal } from "../auth/principal";
import {
  createMedia,
  deleteMedia,
  findBookingStorage,
  saveBookingStorage,
  saveMediaStorage,
  selectRepresentativeMedia,
  updateMediaPreview,
} from "../db/media";
import { findTripForMember } from "../db/trips";
import type { AppEnv } from "../env";

export class MediaError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

const objectId = z.string().trim().min(5).max(200).regex(/^[A-Za-z0-9_-]+$/);
const storageInput = z.object({
  provider: z.literal("google-drive"),
  rootObjectId: objectId,
});
const mediaInput = z.object({
  provider: z.literal("google-drive"),
  providerObjectId: objectId,
  thumbnailObjectId: objectId,
  originalName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().positive().max(30_000),
  height: z.number().int().positive().max(30_000),
  capturedAt: z.iso.datetime({ offset: true }).nullable(),
  aiScore: z.number().min(0).max(1).nullable(),
  aiLabels: z.array(z.string().trim().min(1).max(80)).max(5),
});
const representativeInput = z.object({ mediaId: z.uuid() });
const previewInput = z.object({
  previewCropAspect: z.enum(["1:1", "4:3", "3:4", "16:9"]),
  previewBrightness: z.number().int().min(-20).max(20),
});

async function input<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MediaError(
      400,
      "MEDIA_INPUT_INVALID",
      "사진 정보가 올바르지 않습니다.",
      { issues: parsed.error.issues }
    );
  }
  return parsed.data;
}

async function tripForMember(
  appEnv: AppEnv["Bindings"],
  tripId: string,
  memberId: string
) {
  if (!tripId || tripId.length > 100) {
    throw new MediaError(400, "TRIP_ID_INVALID", "여행 ID가 올바르지 않습니다.");
  }
  const trip = await findTripForMember(appEnv, tripId, memberId);
  if (!trip || trip.deletedAt) {
    throw new MediaError(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }
  return trip;
}

export function registerMediaRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies
) {
  app.get("/api/trips/:id/media/config", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    await tripForMember(c.env, c.req.param("id"), principal.memberId);
    return c.json({
      provider: "google-drive" as const,
      clientId: c.env.GOOGLE_DRIVE_CLIENT_ID ?? null,
    });
  });

  app.put("/api/trips/:id/media/storage", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    await tripForMember(c.env, tripId, principal.memberId);
    if (principal.role !== "owner") {
      throw new MediaError(
        403,
        "MEDIA_STORAGE_OWNER_REQUIRED",
        "Google Drive 폴더 연결은 여행 소유자만 할 수 있습니다."
      );
    }
    const body = await input(c.req.raw, storageInput);
    return c.json({
      storage: await saveMediaStorage(
        c.env,
        principal,
        tripId,
        body.rootObjectId,
        dependencies.now()
      ),
    });
  });

  app.get("/api/trips/:id/media/booking-storage", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    await tripForMember(c.env, tripId, principal.memberId);
    return c.json({ storage: await findBookingStorage(c.env, tripId) });
  });

  app.put("/api/trips/:id/media/booking-storage", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    await tripForMember(c.env, tripId, principal.memberId);
    if (principal.role !== "owner") {
      throw new MediaError(
        403,
        "BOOKING_STORAGE_OWNER_REQUIRED",
        "예약 파일 폴더 연결은 여행 대표자만 할 수 있습니다."
      );
    }
    const body = await input(c.req.raw, storageInput);
    return c.json({
      storage: await saveBookingStorage(
        c.env,
        principal,
        tripId,
        body.rootObjectId,
        dependencies.now()
      ),
    });
  });

  app.post("/api/trips/:id/media", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    await tripForMember(c.env, tripId, principal.memberId);
    const body = await input(c.req.raw, mediaInput);
    const storage = await c.env.DB.prepare(
      "SELECT provider FROM trip_media_storage WHERE trip_id = ?"
    ).bind(tripId).first<{ provider: string }>();
    if (!storage) {
      throw new MediaError(
        409,
        "MEDIA_STORAGE_NOT_CONNECTED",
        "먼저 Google Drive 폴더를 연결해 주세요."
      );
    }
    return c.json({
      media: await createMedia(c.env, principal, tripId, body, dependencies.now()),
    }, 201);
  });

  app.patch("/api/trips/:id/media/representative", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    await tripForMember(c.env, tripId, principal.memberId);
    const body = await input(c.req.raw, representativeInput);
    const updated = await selectRepresentativeMedia(
      c.env,
      principal,
      tripId,
      body.mediaId,
      dependencies.now()
    );
    if (!updated) {
      throw new MediaError(404, "MEDIA_NOT_FOUND", "대표 사진을 찾을 수 없습니다.");
    }
    return c.json({ representativeMediaId: body.mediaId });
  });

  app.patch("/api/trips/:id/media/:mediaId/preview", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    await tripForMember(c.env, tripId, principal.memberId);
    const mediaId = z.uuid().safeParse(c.req.param("mediaId"));
    if (!mediaId.success) {
      throw new MediaError(400, "MEDIA_ID_INVALID", "사진 ID가 올바르지 않습니다.");
    }
    const media = await updateMediaPreview(
      c.env,
      principal,
      tripId,
      mediaId.data,
      await input(c.req.raw, previewInput),
      dependencies.now()
    );
    if (!media) {
      throw new MediaError(404, "MEDIA_NOT_FOUND", "대표 사진을 찾을 수 없습니다.");
    }
    return c.json({ media });
  });

  app.delete("/api/trips/:id/media/:mediaId", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const tripId = c.req.param("id");
    await tripForMember(c.env, tripId, principal.memberId);
    const mediaId = z.uuid().safeParse(c.req.param("mediaId"));
    if (!mediaId.success) {
      throw new MediaError(400, "MEDIA_ID_INVALID", "사진 ID가 올바르지 않습니다.");
    }
    if (!await deleteMedia(c.env, principal, tripId, mediaId.data, dependencies.now())) {
      throw new MediaError(404, "MEDIA_NOT_FOUND", "사진을 찾을 수 없습니다.");
    }
    return c.body(null, 204);
  });
}
