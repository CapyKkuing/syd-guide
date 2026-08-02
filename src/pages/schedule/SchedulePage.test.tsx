import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduleDayView } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
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

async function showFullSchedule() {
  await userEvent.click(screen.getByRole("radio", { name: "전체 일정" }));
}

describe("SchedulePage", () => {
  it("keeps fixture preview read-only with a visible reason", async () => {
    const days = await getScheduleDays();
    render(
      <SchedulePage
        days={days}
        tripId="sydney-2026"
        timeZone="Australia/Sydney"
      />
    );

    expect(screen.getByRole("button", { name: "일정 추가" })).toBeDisabled();
    expect(screen.getByText("미리보기에서는 일정 추가와 내용 수정만 제한됩니다.")).toBeVisible();
  });

  it("switches fixture schedule dates and announces the selected summary", async () => {
    const days = await getScheduleDays();
    render(<SchedulePage days={days} />);

    expect(screen.getByRole("navigation", { name: "Tabs" })
      .closest(".schedule-day-tabs")).not.toBeNull();

    const secondDay = screen.getByRole("button", { name: /DAY 02/ });
    await userEvent.click(secondDay);

    expect(secondDay).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: days[1]!.headline })).toBeVisible();
    expect(screen.getByText(new RegExp(days[1]!.date))).toBeVisible();
    expect(screen.getByText("2개 일정")).toBeVisible();
  });

  it("shows the map view first and opens the selected day as a full list", async () => {
    const days = await getScheduleDays();
    render(<SchedulePage days={days} />);

    expect(screen.getByRole("radio", { name: "지도 동선" })).toBeChecked();
    expect(screen.getByText("지도에 표시할 위치가 있는 장소를 일정에 연결해 주세요.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /호텔 체크인/ })).not.toBeInTheDocument();

    await showFullSchedule();

    expect(screen.getByRole("button", { name: /호텔 체크인/ })).toBeVisible();
  });

  it("opens a read-only detail sheet with all schedule fields and restores opener focus on Escape", async () => {
    const days = await getScheduleDays();
    render(<SchedulePage days={days} />);

    await userEvent.click(screen.getByRole("button", { name: /DAY 02/ }));
    await showFullSchedule();
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

    await showFullSchedule();
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
    await showFullSchedule();
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
    await showFullSchedule();
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

    await showFullSchedule();
    await userEvent.click(screen.getByRole("button", { name: /호텔 체크인/ }));
    expect(within(screen.getByRole("dialog", { name: "일정 상세" }))
      .queryByRole("link", { name: "지도에서 열기" })).not.toBeInTheDocument();
  });

  it("opens the editor for the selected item and submits its current version", async () => {
    const days = await getScheduleDays();
    const selected = days[1]!.items[0]!;
    const editableDays: ScheduleDayView[] = days.map((day, dayIndex) => ({
      ...day,
      id: `day-${dayIndex + 1}`,
      position: dayIndex + 1,
      items: day.items.map((item, itemIndex) => ({
        ...item,
        version: itemIndex + 1,
        tripDayId: `day-${dayIndex + 1}`,
        placeId: null,
        bookingId: null,
        position: itemIndex + 1,
        isFixed: false
      }))
    }));
    const submit = vi.fn().mockResolvedValue({
      entity: "schedule_item",
      entityId: selected.id,
      version: 2,
      syncVersion: 8
    });
    const mutationController: TripMutationController = { submit };
    render(
      <SchedulePage
        days={editableDays}
        tripId="sydney-2026"
        timeZone="Australia/Sydney"
        mutationController={mutationController}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /DAY 02/ }));
    await showFullSchedule();
    await userEvent.click(screen.getByRole("button", { name: /오페라 하우스 가이드 투어/ }));
    await userEvent.click(screen.getByRole("button", { name: "일정 수정" }));
    await userEvent.clear(screen.getByLabelText("일정 제목"));
    await userEvent.type(screen.getByLabelText("일정 제목"), "오페라 하우스 투어");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "schedule_item",
      "update",
      selected.id,
      1,
      expect.objectContaining({ title: "오페라 하우스 투어" })
    );
  });

  it("renders the saved position order instead of sorting the list by time", async () => {
    const days = await getScheduleDays();
    const sourceDay = days[1]!;
    const reversedDay = {
      ...sourceDay,
      items: sourceDay.items.map((item, index) => ({
        ...item,
        position: sourceDay.items.length - index,
      })),
    };
    render(<SchedulePage days={[reversedDay]} />);

    await showFullSchedule();

    const rows = within(screen.getByRole("list")).getAllByRole("button");
    expect(rows[0]).toHaveTextContent(sourceDay.items[1]!.title);
    expect(rows[1]).toHaveTextContent(sourceDay.items[0]!.title);
  });

  it("moves an item down with accessible controls and swaps persisted positions", async () => {
    const days = await getScheduleDays();
    const sourceDay = days[1]!;
    const editableDay: ScheduleDayView = {
      ...sourceDay,
      id: "day-two",
      items: sourceDay.items.map((item, index) => ({
        ...item,
        tripDayId: "day-two",
        version: index + 1,
        position: index + 1,
      })),
    };
    const submit = vi.fn().mockResolvedValue({
      entity: "schedule_item",
      entityId: "updated",
      version: 2,
      syncVersion: 9,
    });
    render(
      <SchedulePage
        days={[editableDay]}
        mutationController={{ submit }}
      />
    );

    await showFullSchedule();
    await userEvent.click(screen.getByRole("button", { name: "순서 편집" }));
    await userEvent.click(screen.getByRole("button", {
      name: `${editableDay.items[0]!.title} 아래로 이동`,
    }));

    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "순서 편집 완료" }));

    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenCalledWith(
      "schedule_item",
      "update",
      editableDay.items[0]!.id,
      editableDay.items[0]!.version,
      expect.objectContaining({ position: 2 })
    );
    expect(submit).toHaveBeenCalledWith(
      "schedule_item",
      "update",
      editableDay.items[1]!.id,
      editableDay.items[1]!.version,
      expect.objectContaining({ position: 1 })
    );
  });

  it("moves an item directly from fourth to first with a mobile pointer drag", async () => {
    const days = await getScheduleDays();
    const sourceDay = days[0]!;
    const baseItem = sourceDay.items[0]!;
    const editableDay: ScheduleDayView = {
      ...sourceDay,
      id: "day-one",
      items: Array.from({ length: 4 }, (_, index) => ({
        ...baseItem,
        id: `drag-item-${index + 1}`,
        title: `드래그 일정 ${index + 1}`,
        tripDayId: "day-one",
        version: index + 1,
        position: index + 1,
      })),
    };
    const submit = vi.fn().mockResolvedValue({
      entity: "schedule_item",
      entityId: "updated",
      version: 2,
      syncVersion: -1,
    });
    render(<SchedulePage days={[editableDay]} mutationController={{ submit }} />);

    await showFullSchedule();
    await userEvent.click(screen.getByRole("button", { name: "순서 편집" }));

    const list = screen.getByRole("list", { name: "일정 순서 편집" });
    const rows = within(list).getAllByRole("listitem");
    const fourth = editableDay.items[3]!;
    const handle = screen.getByRole("button", { name: `${fourth.title} 끌어서 이동` });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => rows[0]!),
    });

    fireEvent.pointerDown(handle, { button: 0, pointerId: 7, clientX: 20, clientY: 500 });
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 20, clientY: 200 });
    fireEvent.pointerUp(handle, { pointerId: 7, clientX: 20, clientY: 200 });

    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(fourth.title);
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "순서 편집 완료" }));
    expect(submit).toHaveBeenCalledTimes(4);
  });

  it("allows a local-only reorder preview with mobile move controls", async () => {
    const days = await getScheduleDays();
    const previewDay = days[1]!;
    render(<SchedulePage days={[previewDay]} />);

    await showFullSchedule();
    await userEvent.click(screen.getByRole("button", { name: "순서 편집" }));

    const firstItem = previewDay.items[0]!;
    const secondItem = previewDay.items[1]!;
    const moveDown = screen.getByRole("button", {
      name: `${firstItem.title} 아래로 이동`,
    });
    expect(moveDown).toBeVisible();

    await userEvent.click(moveDown);

    const rows = within(screen.getByRole("list", { name: "일정 순서 편집" }))
      .getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(secondItem.title);
    expect(rows[1]).toHaveTextContent(firstItem.title);
    expect(screen.getByText(
      `${firstItem.title} 순서를 바꿨습니다. 완료를 누르면 저장됩니다.`
    )).toBeVisible();
  });
});
