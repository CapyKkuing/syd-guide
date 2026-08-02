import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaceEditorDialog } from "./PlaceEditorDialog";

describe("PlaceEditorDialog", () => {
  it("creates a place owned by the current member", async () => {
    const submit = vi.fn().mockResolvedValue({});
    const onClose = vi.fn();
    render(
      <PlaceEditorDialog
        controller={{ submit }}
        onClose={onClose}
        place={null}
        viewerMemberId="owner"
      />
    );

    await userEvent.type(screen.getByLabelText("장소 이름"), "Taronga Zoo");
    await userEvent.type(screen.getByLabelText("주소"), "Bradleys Head Road");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "place",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({
        name: "Taronga Zoo",
        category: "attraction",
        status: "saved",
        savedBy: "owner"
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("blocks an incomplete or out-of-range coordinate pair", async () => {
    const submit = vi.fn();
    render(
      <PlaceEditorDialog
        controller={{ submit }}
        onClose={vi.fn()}
        place={null}
        viewerMemberId="owner"
      />
    );

    await userEvent.type(screen.getByLabelText("장소 이름"), "잘못된 좌표");
    await userEvent.type(screen.getByLabelText("위도"), "91");
    await userEvent.type(screen.getByLabelText("경도"), "151");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByRole("alert")).toHaveTextContent("위도는 -90부터 90 사이");
    expect(submit).not.toHaveBeenCalled();
  });
});
