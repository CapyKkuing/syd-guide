import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotesPanel } from "./NotesPanel";

describe("NotesPanel", () => {
  it("creates a personal note without accepting an unsafe attachment", async () => {
    const submit = vi.fn().mockResolvedValue({});
    render(
      <NotesPanel
        controller={{ submit }}
        notes={[]}
        tripId="trip-one"
        viewerMemberId="owner"
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("메모 공개 범위"), "personal");
    await userEvent.type(screen.getByLabelText("메모 내용"), "여권은 호텔 금고");
    await userEvent.type(screen.getByLabelText("첨부 주소"), "http://unsafe.example/file");
    await userEvent.click(screen.getByRole("button", { name: "메모 추가" }));

    expect(submit).toHaveBeenCalledWith(
      "note",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({
        visibility: "personal",
        body: "여권은 호텔 금고",
        attachmentUrl: null
      })
    );
  });
});
