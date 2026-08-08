import type {
  ActivityLog,
  Booking,
  CheckItem,
  Expense,
  Note,
  Place,
  PublicMember,
  ScheduleItem,
  SettlementTransfer,
  Trip,
  TripDay,
  Vote
} from "./entities";
import type { TripMedia, TripMediaStorage } from "./media";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface TripSnapshot {
  trip: Trip;
  members: PublicMember[];
  days: TripDay[];
  scheduleItems: ScheduleItem[];
  places: Place[];
  bookings: Booking[];
  checkItems: CheckItem[];
  expenses: Expense[];
  settlementTransfers?: SettlementTransfer[];
  notes: Note[];
  votes: Vote[];
  activity: ActivityLog[];
  media?: TripMedia[];
  mediaStorage?: TripMediaStorage | null;
  syncVersion: number;
}
