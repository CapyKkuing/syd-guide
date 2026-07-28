import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReservationCode } from "./ReservationCode";
import { BookingEditorDialog } from "./BookingEditorDialog";

describe("protected bookings", () => {
  it("reveals a reservation code only while pressed", async () => {
    render(<ReservationCode value="ABC12345" />);
    const reveal = screen.getByRole("button", { name: "예약번호 보기" });

    expect(screen.queryByText("ABC12345")).not.toBeInTheDocument();
    fireEvent.pointerDown(reveal);
    expect(screen.getByText("ABC12345")).toBeVisible();
    fireEvent.pointerUp(reveal);
    expect(screen.queryByText("ABC12345")).not.toBeInTheDocument();
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
