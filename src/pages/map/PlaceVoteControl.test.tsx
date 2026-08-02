import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapPlaceView } from "../../data/contracts";
import { PlaceVoteControl } from "./PlaceVoteControl";

const place = {
  id: "place-one",
  version: 1,
  name: "Opera House",
  category: "attraction",
  status: "saved",
  dayDate: null,
  latitude: -33.8,
  longitude: 151.2,
  address: "",
  description: "",
  mapUrl: null,
  sourceUrl: null,
  imageUrl: null,
  savedBy: "owner",
  isRecommended: false,
  isSaved: true,
  provider: null,
  providerPlaceId: null,
  updatedAt: "2026-07-28T00:00:00.000Z",
  votes: []
} satisfies MapPlaceView;

describe("PlaceVoteControl", () => {
  it("creates the current member's first vote", async () => {
    const submit = vi.fn().mockResolvedValue({});
    render(<PlaceVoteControl controller={{ submit }} place={place} viewerMemberId="owner" />);

    await userEvent.click(screen.getByRole("button", { name: "꼭 가요" }));

    expect(submit).toHaveBeenCalledWith(
      "vote",
      "create",
      expect.any(String),
      null,
      { targetType: "place", targetId: "place-one", choice: "must" }
    );
  });

  it("updates an existing vote with its current version", async () => {
    const submit = vi.fn().mockResolvedValue({});
    render(
      <PlaceVoteControl
        controller={{ submit }}
        place={{ ...place, votes: [{ id: "vote-one", version: 3, memberId: "owner", choice: "okay" }] }}
        viewerMemberId="owner"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(submit).toHaveBeenCalledWith(
      "vote",
      "update",
      "vote-one",
      3,
      { targetType: "place", targetId: "place-one", choice: "skip" }
    );
  });
});
