import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { ScheduleDayView } from "../../data/contracts";
import { createSampleDataSource } from "../../test/travelSamples";
import { SchedulePage } from "./SchedulePage";

async function getScheduleDays(): Promise<ScheduleDayView[]> {
  const dataSource = createSampleDataSource(
    () => new Date("2026-07-28T00:00:00.000Z")
  );
  const schedule = await dataSource.getSchedule("sydney-2026");
  if (!schedule) throw new Error("sample schedule missing");
  return schedule.days;
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("SchedulePage", () => {
  it("switches fixture schedule dates and announces the selected summary", async () => {
    const days = await getScheduleDays();
    render(<SchedulePage days={days} />);

    const secondDay = screen.getByRole("button", { name: /DAY 02/ });
    await userEvent.click(secondDay);

    expect(secondDay).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: days[1]!.headline })).toBeVisible();
    expect(screen.getByText(days[1]!.date)).toBeVisible();
    expect(screen.getByText("2개 일정")).toBeVisible();
  });

  it("opens a read-only detail sheet with all schedule fields and restores opener focus on Escape", async () => {
    const days = await getScheduleDays();
    render(<SchedulePage days={days} />);

    await userEvent.click(screen.getByRole("button", { name: /DAY 02/ }));
    const opener = screen.getByRole("button", { name: /오페라 하우스 가이드 투어/ });
    await userEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "일정 상세" });
    expect(within(dialog).getByText("10:30 — 12:00")).toBeVisible();
    expect(within(dialog).getByText("Sydney Opera House")).toBeVisible();
    expect(within(dialog).getByText("관광")).toBeVisible();
    expect(within(dialog).getByText("예약 확정된 가이드 투어에 참여합니다.")).toBeVisible();
    expect(within(dialog).getByText("대중교통 · L2 경전철과 도보")).toBeVisible();
    expect(within(dialog).getByText("예약 확정")).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "지도에서 열기" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Sydney+Opera+House"
    );
    expect(within(dialog).queryByRole("button", { name: /저장|수정|완료/ })).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes only when the backdrop itself is pressed", async () => {
    const days = await getScheduleDays();
    render(<SchedulePage days={days} />);

    await userEvent.click(screen.getByRole("button", { name: /호텔 체크인/ }));
    const dialog = screen.getByRole("dialog", { name: "일정 상세" });
    fireEvent.mouseDown(dialog);
    expect(screen.getByRole("dialog", { name: "일정 상세" })).toBeVisible();

    const backdrop = document.querySelector(".sheet-backdrop");
    if (!backdrop) throw new Error("sheet backdrop missing");
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("traps Tab and Shift+Tab between the current sheet focus targets", async () => {
    const days = await getScheduleDays();
    render(<SchedulePage days={days} />);

    await userEvent.click(screen.getByRole("button", { name: /DAY 02/ }));
    await userEvent.click(screen.getByRole("button", { name: /오페라 하우스 가이드 투어/ }));
    const dialog = screen.getByRole("dialog", { name: "일정 상세" });
    const closeButton = within(dialog).getByRole("button", { name: "닫기" });
    const mapLink = within(dialog).getByRole("link", { name: "지도에서 열기" });

    expect(closeButton).toHaveFocus();
    await userEvent.tab();
    expect(mapLink).toHaveFocus();
    await userEvent.tab();
    expect(closeButton).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(mapLink).toHaveFocus();
  });

  it("restores a nonempty body overflow value and opener focus when unmounted", async () => {
    const days = await getScheduleDays();
    document.body.style.overflow = "clip";
    const view = render(<SchedulePage days={days} />);
    const opener = screen.getByRole("button", { name: /호텔 체크인/ });

    await userEvent.click(opener);
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();

    expect(document.body.style.overflow).toBe("clip");
  });

  it("omits the map link for an unsafe schedule URL", async () => {
    const days = await getScheduleDays();
    const unsafeDays = days.map((day) => ({
      ...day,
      items: day.items.map((item) => item.id === "hotel-check-in"
        ? { ...item, mapUrl: "javascript:alert(document.domain)" }
        : item)
    }));
    render(<SchedulePage days={unsafeDays} />);

    await userEvent.click(screen.getByRole("button", { name: /호텔 체크인/ }));
    expect(within(screen.getByRole("dialog", { name: "일정 상세" }))
      .queryByRole("link", { name: "지도에서 열기" })).not.toBeInTheDocument();
  });
});
