export interface ReelScene {
  id: string;
  mediaId: string;
  durationMs: number;
}

export interface TravelReel {
  tripId: string;
  scenes: ReelScene[];
  excludedMediaIds: string[];
  durationMs: number;
  mode: "auto" | "edited";
}
