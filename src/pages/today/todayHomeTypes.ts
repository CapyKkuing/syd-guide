import type {
  BookingView,
  CheckItemView,
  TodayViewModel,
  TripSummaryViewModel,
} from "../../data/contracts";
import type { PublicMember } from "../../shared/entities";
import type { TripMutationController } from "../../services/mutations/controller";
import type { MediaApi } from "../../services/media/api";
import type { MediaStorageProviderClient } from "../../services/media/provider";
import type { MediaThumbnailStore } from "../../services/offline/mediaThumbnailStore";
import type { TripMedia, TripMediaStorage } from "../../shared/media";

export interface TodayHomeProps {
  bookings: BookingView[];
  checkItems: CheckItemView[];
  members: PublicMember[];
  media?: TripMedia[];
  mediaApi?: MediaApi;
  mediaProvider?: MediaStorageProviderClient;
  mediaStorage?: TripMediaStorage | null;
  mediaThumbnailStore?: MediaThumbnailStore;
  mutationController?: TripMutationController;
  onMediaChanged?: () => void;
  today: TodayViewModel;
  trip: TripSummaryViewModel;
  viewerMemberId: string;
  viewerRole?: "owner" | "partner";
}
