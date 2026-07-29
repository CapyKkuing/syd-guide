import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TripMedia } from "../../../shared/media";
import { ReelEditor } from "./ReelEditor";

function photo(index: number): TripMedia {
  return {
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
    aiScore: 0.8 - index * 0.1,
    aiLabels: ["harbor"],
    createdBy: "owner",
    createdAt: new Date(Date.UTC(2026, 6, index)).toISOString(),
  };
}

describe("ReelEditor", () => {
  it("edits, replaces, undoes, and saves a photo-only silent reel", async () => {
    const user = userEvent.setup();
    const store = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <ReelEditor
        media={[photo(1), photo(2), photo(3)]}
        store={store}
        tripId="trip-one"
      />
    );

    expect(await screen.findByText("0:09")).toBeVisible();
    expect(screen.getByText("사진만 사용 · 음악 없음 · 앱 안에서 미리보기")).toBeVisible();

    const excludeButtons = screen.getAllByRole("button", { name: "제외" });
    await user.click(excludeButtons[1] as HTMLButtonElement);
    expect(await screen.findByText("제외 사진 1장")).toBeVisible();
    expect(screen.getByText("0:06")).toBeVisible();

    const replaceButtons = screen.getAllByRole("button", { name: "교체" });
    await user.click(replaceButtons[0] as HTMLButtonElement);
    await user.click(screen.getByRole("button", { name: "photo-2.jpg로 교체" }));
    expect(await screen.findByText("사진을 같은 위치에서 교체했습니다.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "실행 취소" }));
    expect(await screen.findByText("마지막 편집을 취소했습니다.")).toBeVisible();

    await waitFor(() => expect(store.save).toHaveBeenCalledTimes(4));
    expect(screen.queryByText(/MP4/)).not.toBeInTheDocument();
  });

  it("keeps unavailable Drive photos editable with placeholders", async () => {
    const store = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <ReelEditor media={[photo(1)]} store={store} tripId="trip-one" />
    );

    expect(await screen.findByText("Drive 연결 후 사진 미리보기")).toBeVisible();
    expect(screen.getByRole("button", { name: "미리보기 재생" })).toBeEnabled();
  });
});
