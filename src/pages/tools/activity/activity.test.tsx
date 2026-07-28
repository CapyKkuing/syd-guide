import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityPanel } from "./ActivityPanel";

describe("ActivityPanel", () => {
  it("renders only the latest 100 privacy-safe summaries and reloads", async () => {
    const reload = vi.fn();
    const activity = Array.from({ length: 101 }, (_, index) => ({
      id: `activity-${index}`,
      action: "update",
      summary: `safe summary ${index}`,
      createdAt: new Date(Date.UTC(2026, 6, 28, 0, index)).toISOString()
    }));
    render(<ActivityPanel activity={activity} now={new Date("2026-07-28T03:00:00Z")} reload={reload} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(100);
    expect(screen.queryByText("safe summary 0")).not.toBeInTheDocument();
    screen.getByRole("button", { name: "활동 새로고침" }).click();
    expect(reload).toHaveBeenCalled();
  });
});
