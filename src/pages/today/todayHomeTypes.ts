import type {
  BookingView,
  CheckItemView,
  TodayViewModel,
  TripSummaryViewModel,
} from "../../data/contracts";
import type { PublicMember } from "../../shared/entities";
import type { TripMutationController } from "../../services/mutations/controller";

export interface TodayHomeProps {
  bookings: BookingView[];
  checkItems: CheckItemView[];
  members: PublicMember[];
  mutationController?: TripMutationController;
  today: TodayViewModel;
  trip: TripSummaryViewModel;
  viewerMemberId: string;
}
