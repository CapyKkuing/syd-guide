import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapPlaceView } from "../../data/contracts";
import { MapPlaceSheet } from "./MapPlaceSheet";

const place = {
  id: "place-one",
  version: 1,
  name: "Opera House",
  category: "attraction",
  status: "saved",
  dayDate: null,
  latitude: -33.8,
  longitude: 151.2,
  address: "Bennelong Point",
  description: "Harbour landmark",
  mapUrl: null,
  sourceUrl: null,
  imageUrl: null,
  savedBy: "owner",
  isRecommended: false,
  isSaved: true,
  provider: null,
  providerPlaceId: null,
  updatedAt: "2026-07-28T00:00:00.000Z",
  votes: [{ id: "vote-one", version: 3, memberId: "owner", choice: "must" }]
} satisfies MapPlaceView;

afterEach(() => {
  document.body.style.overflow = "";
});

describe("MapPlaceSheet", () => {
  it("hides place voting while keeping details, directions, and editing", async () => {
    const onEdit = vi.fn();
    const submit = vi.fn().mockResolvedValue({});
    render(
      <MapPlaceSheet
        controller={{ submit }}
        onClose={() => undefined}
        onEdit={onEdit}
        place={place}
        returnFocusTo={null}
      />
    );

    expect(screen.getByRole("heading", { name: "Opera House" })).toBeVisible();
    expect(screen.queryByRole("radio", { name: "꼭 가요" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "괜찮아요" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "건너뛰기" })).not.toBeInTheDocument();
    expect(screen.queryByText(/함께 고른 결과/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "최신 정보 보기" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Opera%20House%2C%20Bennelong%20Point"
    );
    expect(screen.getByRole("link", { name: "길찾기" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=-33.8%2C151.2"
    );

    await userEvent.click(screen.getByRole("button", { name: "장소 수정" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });
});
