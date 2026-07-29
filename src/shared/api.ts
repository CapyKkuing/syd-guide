import type {
  ActivityLog,
  Booking,
  CheckItem,
  Expense,
  Note,
  Place,
  PublicMember,
  ScheduleItem,
  Trip,
  TripDay,
  Vote
} from "./entities";

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
  notes: Note[];
  votes: Vote[];
  activity: ActivityLog[];
  syncVersion: number;
}
