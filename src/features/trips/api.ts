import { z } from "zod";
import type { TravelGuideDataSource } from "../../data/contracts";
import type { Trip, TripStatus } from "../../shared/entities";
import {
  deriveJourneyBoundaries,
  flightDetailsSchema,
  type FlightDetails,
} from "../../shared/flights";

export interface TripLibrarySummary extends Trip {
  country: string | null;
  travelerCount: number;
  bookingCount: number;
  scheduleItemCount: number;
}

export interface TripInput {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  status: TripStatus;
  coverImageUrl: string | null;
  outboundFlight: FlightDetails | null;
  returnFlight: FlightDetails | null;
}

export interface TripLibraryClient {
  readonly readOnlyReason?: string;
  // ESLint's base rule does not recognize TypeScript interface arguments.
  // eslint-disable-next-line no-unused-vars
  list(view: "active" | "trash"): Promise<TripLibrarySummary[]>;
  // eslint-disable-next-line no-unused-vars
  create(input: TripInput): Promise<Trip>;
  // eslint-disable-next-line no-unused-vars
  update(tripId: string, input: TripInput, baseVersion: number): Promise<Trip>;
  // eslint-disable-next-line no-unused-vars
  trash(tripId: string, baseVersion: number): Promise<void>;
  // eslint-disable-next-line no-unused-vars
  restore(tripId: string, baseVersion: number): Promise<Trip>;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function requestHeaders(hostname: string, json = false): Headers {
  const headers = new Headers();
  if (json) headers.set("Content-Type", "application/json");
  if (isLocalHost(hostname)) {
    const principal = localStorage.getItem("couple_dev_principal") === "partner"
      ? "partner"
      : "owner";
    headers.set("X-Dev-Principal", principal);
  }
  return headers;
}

async function apiError(response: Response): Promise<ApiRequestError> {
  const body: unknown = await response.json().catch(() => null);
  const error = typeof body === "object" && body !== null && "error" in body
    ? body.error
    : null;
  const fields = typeof error === "object" && error !== null ? error : null;
  const code = fields && "code" in fields && typeof fields.code === "string"
    ? fields.code
    : "HTTP_ERROR";
  const message = fields && "message" in fields && typeof fields.message === "string"
    ? fields.message
    : "요청을 처리하지 못했습니다.";
  const details = fields && "details" in fields ? fields.details : undefined;
  return new ApiRequestError(
    response.status,
    code,
    message,
    details
  );
}

const sessionMutationCodes = new Set([
  "SESSION_REQUIRED",
  "SESSION_EXPIRED",
  "SESSION_REVOKED"
]);

const accessMutationCodes = new Set([
  "ACCESS_REQUIRED",
  "ACCESS_INVALID"
]);

export function tripLibraryErrorMessage(error: ApiRequestError): string {
  if (sessionMutationCodes.has(error.code)) {
    return "기기 연결이 만료되었습니다. 관리자에게 새 연결 링크를 요청해 다시 연결해 주세요.";
  }
  if (accessMutationCodes.has(error.code)) {
    return "관리자 로그인이 필요합니다. Cloudflare Access 로그인을 다시 진행해 주세요.";
  }
  return error.message;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw await apiError(response);
  return response.json() as Promise<T>;
}

async function requestEmpty(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(path, init);
  if (!response.ok) throw await apiError(response);
}

function tripPath(tripId: string): string {
  return `/api/trips/${encodeURIComponent(tripId)}`;
}

export function createApiTripLibraryClient(
  hostname: () => string = () => window.location.hostname
): TripLibraryClient {
  return {
    async list(view) {
      const response = await requestJson<{ trips: TripLibrarySummary[] }>(
        `/api/trips?view=${view}`,
        { headers: requestHeaders(hostname()) }
      );
      return response.trips;
    },
    async create(input) {
      const response = await requestJson<{ trip: Trip }>("/api/trips", {
        method: "POST",
        headers: requestHeaders(hostname(), true),
        body: JSON.stringify(input)
      });
      return response.trip;
    },
    async update(tripId, input, baseVersion) {
      const response = await requestJson<{ trip: Trip }>(tripPath(tripId), {
        method: "PATCH",
        headers: requestHeaders(hostname(), true),
        body: JSON.stringify({ ...input, baseVersion })
      });
      return response.trip;
    },
    async trash(tripId, baseVersion) {
      await requestEmpty(tripPath(tripId), {
        method: "DELETE",
        headers: requestHeaders(hostname(), true),
        body: JSON.stringify({ baseVersion })
      });
    },
    async restore(tripId, baseVersion) {
      const response = await requestJson<{ trip: Trip }>(
        `${tripPath(tripId)}/restore`,
        {
          method: "POST",
          headers: requestHeaders(hostname(), true),
          body: JSON.stringify({ baseVersion })
        }
      );
      return response.trip;
    }
  };
}

export const apiTripLibraryClient = createApiTripLibraryClient();

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const httpsUrlSchema = z.url().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
});

const coverImageSchema = z.union([
  httpsUrlSchema,
  z.string().regex(/^\/images\/[A-Za-z0-9._/-]+$/)
]);

export const tripInputSchema = z.object({
  title: z.string().trim().min(1, "여행 제목을 입력하세요.").max(80),
  destination: z.string().trim().min(1, "여행지를 입력하세요.").max(120),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  timeZone: z.string().refine(validTimeZone, "유효한 IANA 시간대를 입력하세요."),
  status: z.enum(["upcoming", "active", "completed"]),
  coverImageUrl: coverImageSchema.nullable(),
  outboundFlight: flightDetailsSchema.nullable(),
  returnFlight: flightDetailsSchema.nullable()
}).refine((trip) => trip.endDate >= trip.startDate, {
  message: "종료일은 시작일보다 빠를 수 없습니다.",
  path: ["endDate"]
}).refine((trip) => {
  const boundary = deriveJourneyBoundaries(
    trip.outboundFlight,
    trip.returnFlight
  );
  return boundary.journeyStartsAt === null
    || boundary.journeyEndsAt === null
    || Date.parse(boundary.journeyStartsAt) < Date.parse(boundary.journeyEndsAt);
}, {
  message: "여정 종료시각은 시작시각보다 늦어야 합니다.",
  path: ["returnFlight", "scheduledArrivalAt"]
});

function readOnlyError(reason: string): never {
  throw new ApiRequestError(405, "READ_ONLY_PREVIEW", reason);
}

export function createFixturePreviewTripLibraryClient(
  dataSource: TravelGuideDataSource,
  reason = "GitHub Pages 미리보기에서는 여행을 조회만 할 수 있습니다."
): TripLibraryClient {
  return {
    readOnlyReason: reason,
    async list(view) {
      if (view === "trash") return [];
      const trips = await dataSource.listTrips();
      return Promise.all(trips.map(async (trip) => {
        const schedule = await dataSource.getSchedule(trip.id);
        return {
          id: trip.id,
          title: trip.title,
          country: trip.country,
          destination: trip.destination,
          startDate: trip.startDate,
          endDate: trip.endDate,
          timeZone: trip.timeZone,
          status: trip.phase,
          coverImageUrl: trip.coverImageUrl,
          journeyStartsAt: null,
          journeyEndsAt: null,
          outboundFlight: null,
          returnFlight: null,
          representativeMediaId: null,
          version: 1,
          syncVersion: 0,
          deletedAt: null,
          purgeAfter: null,
          createdBy: "preview",
          updatedBy: "preview",
          createdAt: trip.updatedAt,
          updatedAt: trip.updatedAt,
          travelerCount: trip.travelerCount,
          bookingCount: trip.bookingCount,
          scheduleItemCount: schedule?.days.reduce(
            (count, day) => count + day.items.length,
            0
          ) ?? 0
        };
      }));
    },
    create: async () => readOnlyError(reason),
    update: async () => readOnlyError(reason),
    trash: async () => readOnlyError(reason),
    restore: async () => readOnlyError(reason)
  };
}
