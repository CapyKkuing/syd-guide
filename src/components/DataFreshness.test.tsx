import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataFreshness } from "./DataFreshness";

describe("DataFreshness", () => {
  it("labels cached data with its update time", () => {
    render(<DataFreshness value={{ source: "cached", updatedAt: "2026-10-10T01:00:00Z" }} />);

    expect(screen.getByText("저장됨")).toBeVisible();
    expect(screen.getByText(/마지막 업데이트/)).toBeVisible();
  });

  it("makes sample data explicit", () => {
    render(<DataFreshness value={{ source: "sample", updatedAt: null }} />);

    expect(screen.getByText("샘플")).toBeVisible();
  });
});
