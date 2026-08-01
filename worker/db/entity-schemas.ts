import { z } from "zod";
import type { EntityKind } from "../../src/shared/entities";

export const idSchema = z.string().regex(/^[A-Za-z0-9-]{1,100}$/);
const shortText = z.string().trim().min(1).max(160);
const longText = z.string().max(5_000);
const nullableId = idSchema.nullable();
const position = z.number().int().min(0).max(9_999);
const timestamp = z.iso.datetime({ offset: true });
const nullableTimestamp = timestamp.nullable();
const httpsUrl = z.string().max(2_048).refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "HTTPS 주소만 사용할 수 있습니다.");
const nullableUrl = httpsUrl.nullable();
const imageUrl = z.union([
  httpsUrl,
  z.string().max(2_048).regex(/^\/images\/[A-Za-z0-9._/-]+$/),
]);

export const entitySchemas = {
  trip_day: z.object({
    dayDate: z.iso.date(),
    title: shortText,
    position,
  }),
  schedule_item: z.object({
    tripDayId: idSchema,
    placeId: nullableId,
    bookingId: nullableId,
    title: shortText,
    startsAt: nullableTimestamp,
    endsAt: nullableTimestamp,
    memo: longText,
    travelMode: z.enum(["walk", "transit", "drive", "ferry", "other"]).nullable(),
    travelNote: longText,
    position,
    isFixed: z.boolean(),
    isDone: z.boolean(),
  }),
  place: z.object({
    name: shortText,
    category: z.enum(["restaurant", "cafe", "attraction", "lodging", "transport"]),
    status: z.enum(["saved", "maybe", "visited"]),
    address: z.string().max(5_000).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    mapUrl: nullableUrl,
    sourceUrl: nullableUrl,
    imageUrl: imageUrl.nullable(),
    description: longText,
    savedBy: nullableId,
  }),
  booking: z.object({
    placeId: nullableId,
    bookingType: z.enum([
      "flight", "lodging", "ticket", "tour", "transport", "restaurant", "other",
    ]),
    provider: shortText,
    startsAt: timestamp,
    endsAt: nullableTimestamp,
    reservationCode: z.string().max(160).nullable(),
    paymentStatus: z.enum(["unpaid", "partial", "paid", "refunded"]),
    externalUrl: nullableUrl,
    documentUrl: nullableUrl,
    documentFile: z.object({
      provider: z.literal("google-drive"),
      providerObjectId: idSchema,
      originalName: z.string().trim().min(1).max(180),
      mimeType: z.enum([
        "image/jpeg", "image/png", "image/webp", "application/pdf",
      ]),
    }).nullable().default(null),
    memo: longText,
    isFixed: z.boolean(),
    isRequired: z.boolean(),
  }),
  check_item: z.object({
    phase: z.enum(["pretrip", "travel"]).default("pretrip"),
    category: z.enum(["essential", "reservation", "packing", "travel"]).default("essential"),
    scope: z.enum(["shared", "personal"]),
    ownerMemberId: nullableId,
    assigneeMemberId: nullableId,
    title: shortText,
    quantity: z.number().int().min(1).max(99),
    memo: longText,
    requirementKind: z.enum(["passport", "essential"]).nullable(),
    isDone: z.boolean(),
    position,
  }),
  expense: z.object({
    phase: z.enum(["pretrip", "travel"]),
    category: z.enum([
      "flight", "lodging", "reservation", "food", "transport", "shopping", "activity", "other",
    ]),
    customCategory: shortText.nullable().optional(),
    title: shortText,
    amountMinor: z.number().int().min(1).max(999_999_999_999),
    currency: z.string().regex(/^[A-Z]{3}$/),
    spentOn: z.iso.date(),
    paidByMemberId: idSchema,
    expenseScope: z.enum(["shared", "personal"]).nullable(),
    personalForMemberId: nullableId,
    paymentMethod: z.enum(["cash", "card"]).nullable(),
    isSettled: z.boolean(),
    memo: longText,
  }),
  note: z.object({
    targetType: z.enum(["trip", "schedule_item", "place", "booking"]),
    targetId: nullableId,
    visibility: z.enum(["shared", "personal"]),
    body: longText,
    attachmentUrl: nullableUrl,
  }),
  vote: z.object({
    targetType: z.enum(["place", "schedule_item"]),
    targetId: idSchema,
    choice: z.enum(["must", "okay", "skip"]),
  }),
} satisfies Record<EntityKind, z.ZodType>;
