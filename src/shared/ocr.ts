import type { MutationPayloadMap } from "./mutations";

export interface BookingOcrDraft {
  bookingType: MutationPayloadMap["booking"]["bookingType"] | null;
  provider: string | null;
  reservationCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface BookingOcrResult {
  draft: BookingOcrDraft;
  rawText: string;
  usage: {
    used: number;
    limit: number;
  };
}
