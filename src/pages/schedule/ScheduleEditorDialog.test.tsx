import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapPlaceView, ScheduleDayView } from "../../data/contracts";
import type { TripMutationController } from "../../services/mutations/controller";
import { ScheduleEditorDialog } from "./ScheduleEditorDialog";

const day: ScheduleDayView = {
  id: "day-one",
  position: 1,
  date: "2026-09-10",
  dayLabel: "DAY 01",
  headline: "하버 첫날",
  items: []
};

const places = [{
  id: "place-opera",
  version: 1,
  name: "Sydney Opera House",
  category: "attraction",
  status: "saved",
  dayDate: day.date,
  latitude: -33.8568,
  longitude: 151.2153,
  address: "Bennelong Point",
  description: "",
  mapUrl: null,
  sourceUrl: null,
  imageUrl: null,
  savedBy: "owner",
  updatedAt: "2026-09-09T00:00:00.000Z",
  votes: []
}] satisfies MapPlaceView[];

const item = {
  id: "schedule-opera",
  version: 3,
  tripDayId: "day-one",
  placeId: "place-opera",
  bookingId: null,
  startsAt: "2026-09-10T13:00:00+10:00",
  endsAt: "2026-09-10T14:00:00+10:00",
  title: "오페라 하우스",
  place: "Sydney Opera House",
  description: "가이드 투어",
  kind: "attraction" as const,
  travelMode: null,
  travelNote: null,
  bookingStatus: null,
  bookingProvider: null,
  updatedAt: "2026-09-09T00:00:00.000Z",
  position: 1,
  isFixed: true,
  isDone: false,
  mapUrl: null
};

function controller(): TripMutationController {
  return { submit: vi.fn().mockResolvedValue({
    entity: "schedule_item",
    entityId: "schedule-new",
    version: 1,
    syncVersion: 8
  }) };
}

describe("ScheduleEditorDialog", () => {
  it("creates an item with the selected day, next position, and trip offset", async () => {
    const mutationController = controller();
    const onClose = vi.fn();
    render(
      <ScheduleEditorDialog
        day={day}
        item={null}
        mutationController={mutationController}
        onClose={onClose}
        places={places}
        timeZone="Australia/Sydney"
      />
    );

    await userEvent.type(screen.getByLabelText("일정 제목"), "오페라 하우스");
    await userEvent.type(screen.getByLabelText("시작 시간"), "13:00");
    await userEvent.selectOptions(screen.getByLabelText("연결 장소"), "place-opera");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(mutationController.submit).toHaveBeenCalledWith(
      "schedule_item",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({
        tripDayId: "day-one",
        title: "오페라 하우스",
        placeId: "place-opera",
        startsAt: "2026-09-10T13:00:00+10:00",
        position: 1
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the dialog open and announces a mutation error", async () => {
    const mutationController = controller();
    vi.mocked(mutationController.submit).mockRejectedValue(
      new Error("다른 기기에서 수정했습니다.")
    );
    render(
      <ScheduleEditorDialog
        day={day}
        item={null}
        mutationController={mutationController}
        onClose={vi.fn()}
        places={places}
        timeZone="Australia/Sydney"
      />
    );

    await userEvent.type(screen.getByLabelText("일정 제목"), "오페라 하우스");
    await userEvent.type(screen.getByLabelText("시작 시간"), "13:00");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "다른 기기에서 수정했습니다."
    );
    expect(screen.getByRole("dialog", { name: "일정 추가" })).toBeVisible();
  });

  it("updates the current entity version without changing its linked fields", async () => {
    const mutationController = controller();
    render(
      <ScheduleEditorDialog
        day={{ ...day, items: [item] }}
        item={item}
        mutationController={mutationController}
        onClose={vi.fn()}
        places={places}
        timeZone="Australia/Sydney"
      />
    );

    await userEvent.clear(screen.getByLabelText("일정 제목"));
    await userEvent.type(screen.getByLabelText("일정 제목"), "오페라 하우스 투어");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(mutationController.submit).toHaveBeenCalledWith(
      "schedule_item",
      "update",
      "schedule-opera",
      3,
      expect.objectContaining({
        tripDayId: "day-one",
        placeId: "place-opera",
        title: "오페라 하우스 투어",
        position: 1,
        isFixed: true
      })
    );
  });

  it("requires an extra confirmation before deleting a fixed item", async () => {
    const mutationController = controller();
    render(
      <ScheduleEditorDialog
        day={{ ...day, items: [item] }}
        item={item}
        mutationController={mutationController}
        onClose={vi.fn()}
        places={places}
        timeZone="Australia/Sydney"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByText("오페라 하우스 일정을 삭제할까요?")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
    expect(screen.getByText("고정 일정입니다. 그래도 삭제할까요?")).toBeVisible();
    expect(mutationController.submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "고정 일정 삭제" }));

    expect(mutationController.submit).toHaveBeenCalledWith(
      "schedule_item",
      "delete",
      "schedule-opera",
      3,
      null
    );
  });
});
