import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BookingView } from "../../../data/contracts";
import type { ScheduleItemView } from "../../../data/contracts";
import type { BookingDocumentRuntime } from "../../../services/media/bookingDocumentRuntime";
import { BookingsPanel } from "./BookingsPanel";
import { ReservationCode } from "./ReservationCode";
import { BookingEditorDialog } from "./BookingEditorDialog";

const bookings: BookingView[] = [
  {
    id: "flight", tripId: "sydney", version: 1, updatedAt: "2026-07-01T00:00:00", updatedBy: "minji",
    placeId: null, bookingType: "flight", provider: "대한항공 KE401", startsAt: "2026-07-29T18:05:00",
    endsAt: null, reservationCode: "KE-PRIVATE", paymentStatus: "paid", externalUrl: null, documentUrl: null,
    memo: "", isFixed: true, isRequired: true
  },
  {
    id: "tour", tripId: "sydney", version: 1, updatedAt: "2026-07-01T00:00:00", updatedBy: "minji",
    placeId: null, bookingType: "tour", provider: "오페라하우스 투어", startsAt: "2026-07-31T10:30:00",
    endsAt: null, reservationCode: null, paymentStatus: "paid", externalUrl: null, documentUrl: null,
    memo: "", isFixed: true, isRequired: false
  }
];

describe("protected bookings", () => {
  it("highlights the earliest booking before departure and today's booking during travel", () => {
    const { rerender } = render(
      <BookingsPanel bookings={bookings} experiencePhase="before" places={[]} timeZone="Australia/Sydney" />
    );

    expect(screen.getByText("출발 전 확인할 예약")).toBeVisible();
    expect(screen.getByText("대한항공 KE401")).toBeVisible();

    rerender(
      <BookingsPanel
        bookings={bookings}
        experiencePhase="during"
        localDate="2026-07-31"
        places={[]}
        timeZone="Australia/Sydney"
      />
    );

    expect(screen.getByText("지금 확인할 예약")).toBeVisible();
    expect(screen.getByText("오페라하우스 투어")).toBeVisible();
  });

  it("reveals a reservation code only while pressed", async () => {
    render(<ReservationCode value="ABC12345" />);
    const reveal = screen.getByRole("button", { name: "예약번호 보기" });

    expect(screen.queryByText("ABC12345")).not.toBeInTheDocument();
    fireEvent.pointerDown(reveal);
    expect(screen.getByText("ABC12345")).toBeVisible();
    fireEvent.pointerUp(reveal);
    expect(screen.queryByText("ABC12345")).not.toBeInTheDocument();
  });

  it("opens a booking detail sheet without exposing its reservation code", async () => {
    render(
      <BookingsPanel bookings={bookings} experiencePhase="before" places={[]} timeZone="Australia/Sydney" />
    );

    await userEvent.click(screen.getByRole("button", { name: "체크인 · 예약 정보 보기" }));

    const detail = screen.getByRole("dialog", { name: "예약 상세" });
    expect(detail).toHaveTextContent("대한항공 KE401");
    expect(detail).not.toHaveTextContent("KE-PRIVATE");
  });

  it("creates a booking without changing its reservation value", async () => {
    const submit = vi.fn().mockResolvedValue({});
    render(
      <BookingEditorDialog
        booking={null}
        controller={{ submit }}
        onClose={vi.fn()}
        places={[]}
        timeZone="Australia/Sydney"
      />
    );
    await userEvent.type(screen.getByLabelText("예약처"), "Qantas");
    await userEvent.type(screen.getByLabelText("시작 일시"), "2026-09-10T10:00");
    await userEvent.type(screen.getByLabelText("예약번호"), "QF-PRIVATE");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(submit).toHaveBeenCalledWith(
      "booking",
      "create",
      expect.any(String),
      null,
      expect.objectContaining({
        provider: "Qantas",
        reservationCode: "QF-PRIVATE"
      })
    );
  });

  it("uploads a voucher and links only the schedule candidate selected by the user", async () => {
    const submit = vi.fn().mockResolvedValue({});
    const documentRuntime: BookingDocumentRuntime = {
      upload: vi.fn().mockResolvedValue({
        provider: "google-drive",
        providerObjectId: "voucher-object",
        originalName: "voucher.pdf",
        mimeType: "application/pdf",
      }),
      download: vi.fn(),
      remove: vi.fn(),
    };
    const scheduleItem: ScheduleItemView = {
      id: "schedule-tour",
      version: 2,
      tripDayId: "day-two",
      placeId: null,
      bookingId: null,
      startsAt: "2026-09-10T11:00:00+10:00",
      endsAt: null,
      title: "오페라 하우스 투어",
      place: "Sydney Opera House",
      description: "",
      kind: "attraction",
      travelMode: null,
      travelNote: null,
      bookingStatus: null,
      bookingProvider: null,
      updatedAt: "2026-08-01T00:00:00.000Z",
      position: 1,
      isFixed: false,
      isDone: false,
      mapUrl: null,
    };
    render(
      <BookingEditorDialog
        booking={null}
        controller={{ submit }}
        documentRuntime={documentRuntime}
        onClose={vi.fn()}
        places={[]}
        scheduleItems={[scheduleItem]}
        timeZone="Australia/Sydney"
      />
    );

    await userEvent.type(screen.getByLabelText("예약처"), "Opera Tour");
    await userEvent.type(screen.getByLabelText("시작 일시"), "2026-09-10T10:00");
    await userEvent.selectOptions(
      screen.getByLabelText("연결할 기존 일정"),
      scheduleItem.id
    );
    await userEvent.upload(
      screen.getByLabelText("예약 사진·PDF"),
      new File(["voucher"], "voucher.pdf", { type: "application/pdf" })
    );
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(documentRuntime.upload).toHaveBeenCalledOnce();
    const bookingCall = submit.mock.calls[0];
    expect(bookingCall?.[0]).toBe("booking");
    expect(bookingCall?.[4]).toEqual(expect.objectContaining({
      documentFile: expect.objectContaining({
        providerObjectId: "voucher-object",
      }),
    }));
    expect(submit.mock.calls[1]).toEqual([
      "schedule_item",
      "update",
      scheduleItem.id,
      scheduleItem.version,
      expect.objectContaining({ bookingId: bookingCall?.[2] }),
    ]);
  });

  it("keeps an uploaded voucher when the booking saves but schedule linking fails", async () => {
    const submit = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("schedule failed"));
    const documentRuntime: BookingDocumentRuntime = {
      upload: vi.fn().mockResolvedValue({
        provider: "google-drive",
        providerObjectId: "voucher-object",
        originalName: "voucher.pdf",
        mimeType: "application/pdf",
      }),
      download: vi.fn(),
      remove: vi.fn(),
    };
    const scheduleItem: ScheduleItemView = {
      id: "schedule-tour",
      version: 2,
      tripDayId: "day-two",
      placeId: null,
      bookingId: null,
      startsAt: "2026-09-10T11:00:00+10:00",
      endsAt: null,
      title: "오페라 하우스 투어",
      place: "Sydney Opera House",
      description: "",
      kind: "attraction",
      travelMode: null,
      travelNote: null,
      bookingStatus: null,
      bookingProvider: null,
      updatedAt: "2026-08-01T00:00:00.000Z",
      position: 1,
      isFixed: false,
      isDone: false,
      mapUrl: null,
    };
    render(
      <BookingEditorDialog
        booking={null}
        controller={{ submit }}
        documentRuntime={documentRuntime}
        onClose={vi.fn()}
        places={[]}
        scheduleItems={[scheduleItem]}
        timeZone="Australia/Sydney"
      />
    );

    await userEvent.type(screen.getByLabelText("예약처"), "Opera Tour");
    await userEvent.type(screen.getByLabelText("시작 일시"), "2026-09-10T10:00");
    await userEvent.selectOptions(screen.getByLabelText("연결할 기존 일정"), scheduleItem.id);
    await userEvent.upload(
      screen.getByLabelText("예약 사진·PDF"),
      new File(["voucher"], "voucher.pdf", { type: "application/pdf" })
    );
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("예약은 저장됐지만 일정 연결에 실패했습니다.");
    expect(documentRuntime.remove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "예약 저장됨" })).toBeDisabled();
  });

  it("loads an attached voucher preview from Drive on demand", async () => {
    const documentRuntime: BookingDocumentRuntime = {
      upload: vi.fn(),
      download: vi.fn().mockResolvedValue(new Blob(["image"], {
        type: "image/jpeg",
      })),
      remove: vi.fn(),
    };
    const booking = {
      ...bookings[1]!,
      documentFile: {
        provider: "google-drive" as const,
        providerObjectId: "voucher-photo",
        originalName: "ticket.jpg",
        mimeType: "image/jpeg" as const,
      },
    };
    render(
      <BookingsPanel
        bookings={[booking]}
        documentRuntime={documentRuntime}
        places={[]}
        timeZone="Australia/Sydney"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "예약 정보 보기" }));
    await userEvent.click(screen.getByRole("button", { name: "Drive 미리보기" }));

    expect(documentRuntime.download).toHaveBeenCalledWith(booking.documentFile);
    expect(await screen.findByAltText("ticket.jpg 미리보기")).toBeVisible();
  });
});
