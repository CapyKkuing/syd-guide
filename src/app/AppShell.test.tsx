import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("shows the product name and mobile navigation", () => {
    render(
      <AppShell currentPage="library">
        <p>화면</p>
      </AppShell>
    );

    expect(screen.getByText("둘만의 여행 가이드북")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
    expect(screen.getByText("화면")).toBeVisible();
  });
});
