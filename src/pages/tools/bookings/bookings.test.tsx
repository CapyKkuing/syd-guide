import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BookingView } from "../../../data/contracts";
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
});
