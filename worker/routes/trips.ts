import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import {
  deriveJourneyBoundaries,
  flightDetailsSchema,
} from "../../src/shared/flights";
import type { AppDependencies } from "../auth/access";
import { requirePrincipal } from "../auth/principal";
import {
  createTrip,
  listTripsForMember,
  restoreTrip,
  trashTrip,
  updateTrip,
  type TripMutationResult,
} from "../db/trips";
import type { AppEnv } from "../env";

export class TripError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const httpsUrlSchema = z.url().refine(
  isHttpsUrl,
  "HTTPS 주소만 사용할 수 있습니다."
);
const imageUrlSchema = z.union([
  httpsUrlSchema,
  z.string().regex(/^\/images\/[A-Za-z0-9._/-]+$/),
]);
const tripInputSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    destination: z.string().trim().min(1).max(120),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    timeZone: z
      .string()
      .refine(isValidTimeZone, "유효한 IANA 시간대를 입력하세요."),
    status: z.enum(["upcoming", "active", "completed"]),
    coverImageUrl: imageUrlSchema.nullable(),
    outboundFlight: flightDetailsSchema.nullable().default(null),
    returnFlight: flightDetailsSchema.nullable().default(null),
  })
  .refine((trip) => trip.endDate >= trip.startDate, {
    message: "종료일은 시작일보다 빠를 수 없습니다.",
    path: ["endDate"],
  })
  .refine((trip) => {
    const boundary = deriveJourneyBoundaries(
      trip.outboundFlight,
      trip.returnFlight
    );
    return boundary.journeyStartsAt === null
      || boundary.journeyEndsAt === null
      || Date.parse(boundary.journeyStartsAt) < Date.parse(boundary.journeyEndsAt);
  }, {
    message: "여정 종료시각은 시작시각보다 늦어야 합니다.",
    path: ["returnFlight", "scheduledArrivalAt"],
  });
const versionSchema = z.object({
  baseVersion: z.number().int().positive(),
});
const updateSchema = tripInputSchema.and(versionSchema);

async function readInput<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.output<T>> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new TripError(
      400,
      "TRIP_INPUT_INVALID",
      "여행 입력값이 올바르지 않습니다.",
      { issues: parsed.error.issues }
    );
  }
  return parsed.data;
}

function tripId(value: string): string {
  if (!value || value.length > 100) {
    throw new TripError(400, "TRIP_ID_INVALID", "여행 ID가 올바르지 않습니다.");
  }
  return value;
}

function unwrap(result: TripMutationResult) {
  if (result.ok) return result.trip;
  if (result.reason === "not-found") {
    throw new TripError(404, "TRIP_NOT_FOUND", "여행을 찾을 수 없습니다.");
  }
  if (result.reason === "conflict") {
    throw new TripError(
      409,
      "VERSION_CONFLICT",
      "다른 기기에서 여행이 수정되었습니다.",
      { current: result.current }
    );
  }
  if (result.reason === "purge-expired") {
    throw new TripError(
      410,
      "TRIP_PURGE_EXPIRED",
      "여행의 복구 가능 기간이 지났습니다."
    );
  }
  throw new TripError(
    409,
    "TRIP_STATE_INVALID",
    "현재 상태에서는 요청을 처리할 수 없습니다.",
    { current: result.current }
  );
}

export function registerTripRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies
) {
  app.use("/api/trips", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    await next();
  });
  app.use("/api/trips/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    await next();
  });

  app.get("/api/trips", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const view = c.req.query("view") ?? "active";
    if (view !== "active" && view !== "trash") {
      throw new TripError(
        400,
        "TRIP_VIEW_INVALID",
        "여행 목록 보기 방식이 올바르지 않습니다."
      );
    }
    return c.json({
      trips: await listTripsForMember(c.env, principal.memberId, view),
    });
  });

  app.post("/api/trips", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const input = await readInput(c.req.raw, tripInputSchema);
    return c.json(
      { trip: await createTrip(c.env, principal, input, dependencies.now()) },
      201
    );
  });

  app.patch("/api/trips/:id", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const { baseVersion, ...input } = await readInput(
      c.req.raw,
      updateSchema
    );
    const result = await updateTrip(
      c.env,
      principal,
      tripId(c.req.param("id")),
      input,
      baseVersion,
      dependencies.now()
    );
    return c.json({ trip: unwrap(result) });
  });

  app.delete("/api/trips/:id", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const { baseVersion } = await readInput(c.req.raw, versionSchema);
    unwrap(
      await trashTrip(
        c.env,
        principal,
        tripId(c.req.param("id")),
        baseVersion,
        dependencies.now()
      )
    );
    return c.body(null, 204);
  });

  app.post("/api/trips/:id/restore", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const { baseVersion } = await readInput(c.req.raw, versionSchema);
    const trip = unwrap(
      await restoreTrip(
        c.env,
        principal,
        tripId(c.req.param("id")),
        baseVersion,
        dependencies.now()
      )
    );
    return c.json({ trip });
  });
}
