import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../../../app/theme/ThemeProvider";
import type { MapPlaceView } from "../../../data/contracts";
import { PlaceCategoryPanel } from "./PlaceCategoryPanel";

const places = [
  place("restaurant", "Quay"),
  place("cafe", "Sample Coffee"),
];

describe("PlaceCategoryPanel", () => {
  it("keeps categories separate and creates with the selected category", async () => {
    const submit = vi.fn().mockResolvedValue({});
    render(
      <ThemeProvider>
        <PlaceCategoryPanel
          category="restaurant"
          controller={{ submit }}
          emptyMessage="맛집 없음"
          places={places}
          viewerMemberId="owner"
        />
      </ThemeProvider>
    );

    expect(screen.getByRole("heading", { name: "Quay" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Sample Coffee" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "장소 추가" }));
    await userEvent.type(screen.getByLabelText("장소 이름"), "New Restaurant");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "place",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({ category: "restaurant", name: "New Restaurant" })
    );
  });
});

function place(category: MapPlaceView["category"], name: string): MapPlaceView {
  return {
    id: name.toLocaleLowerCase().replaceAll(" ", "-"),
    version: 1,
    name,
    category,
    status: "saved",
    dayDate: null,
    latitude: null,
    longitude: null,
    address: "Sydney",
    description: "",
    mapUrl: null,
    sourceUrl: null,
    imageUrl: null,
    savedBy: "owner",
    updatedAt: "2026-08-02T00:00:00.000Z",
    votes: [],
  };
}
