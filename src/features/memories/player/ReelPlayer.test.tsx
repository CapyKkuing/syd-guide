import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { TripMedia } from "../../../shared/media";
import type { TravelReel } from "../reel/types";
import { ReelPlayer } from "./ReelPlayer";

const media: TripMedia[] = [1, 2].map((index) => ({
  id: `media-${index}`,
  tripId: "trip-one",
  kind: "photo",
  provider: "google-drive",
  providerObjectId: `original-${index}`,
  thumbnailObjectId: `thumb-${index}`,
  originalName: `photo-${index}.jpg`,
  mimeType: "image/jpeg",
  width: 1600,
  height: 900,
  capturedAt: null,
  aiScore: 0.8,
  aiLabels: ["harbor"],
  createdBy: "owner",
  createdAt: new Date(Date.UTC(2026, 6, index)).toISOString(),
}));

const reel: TravelReel = {
  tripId: "trip-one",
  scenes: media.map((item) => ({
    id: `scene-${item.id}`,
    mediaId: item.id,
    durationMs: 3_000,
  })),
  excludedMediaIds: [],
  durationMs: 6_000,
  mode: "edited",
};

function renderPlayer() {
  return render(
    <ReelPlayer
      editHref="/trip/trip-one/memories"
      exitHref="/trip/trip-one/today"
      media={media}
      reel={reel}
      tripId="trip-one"
      tripTitle="시드니 여행"
    />
  );
}

describe("ReelPlayer", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("shows controls without pausing and keeps side navigation playing", async () => {
    const user = userEvent.setup();
    renderPlayer();

    await user.click(
      screen.getByRole("button", { name: "재생 컨트롤 표시" })
    );
    expect(screen.getByRole("button", { name: "일시정지" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(screen.getByText("2 / 2")).toBeVisible();
    expect(screen.getByRole("button", { name: "일시정지" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "일시정지" }));
    expect(screen.getByRole("button", { name: "재생" })).toBeEnabled();
  });

  it("offers resume or restart from a saved scene", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      "travel-reel-checkpoint:trip-one",
      JSON.stringify({ sceneId: "scene-media-2", completed: false })
    );
    renderPlayer();

    expect(
      screen.getByRole("heading", { name: "이어서 볼까요?" })
    ).toBeVisible();
    expect(screen.getByText("2번째 사진 처음부터 이어집니다.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "처음부터" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeVisible();
  });
});
