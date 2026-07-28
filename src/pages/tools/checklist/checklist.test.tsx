import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChecklistPanel } from "./ChecklistPanel";

describe("ChecklistPanel", () => {
  it("forces personal checklist ownership to the current member", async () => {
    const submit = vi.fn().mockResolvedValue({});
    render(
      <ChecklistPanel
        controller={{ submit }}
        items={[]}
        members={[]}
        viewerMemberId="partner"
      />
    );

    await userEvent.selectOptions(screen.getByLabelText("준비물 범위"), "personal");
    await userEvent.type(screen.getByLabelText("준비물"), "충전기");
    await userEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(submit).toHaveBeenCalledWith(
      "check_item",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({
        scope: "personal",
        ownerMemberId: "partner",
        title: "충전기"
      })
    );
  });
});
