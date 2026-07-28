import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { OutboxRecord } from "../offline/database";
import { ConflictDialog } from "./ConflictDialog";

const conflict: OutboxRecord = {
  idempotencyKey: "booking-conflict",
  tripId: "sydney-2026",
  mutation: {
    idempotencyKey: "booking-conflict",
    entity: "booking",
    action: "update",
    entityId: "booking-1",
    baseVersion: 2,
    payload: {
      placeId: null,
      bookingType: "lodging",
      provider: "Harbour Hotel",
      startsAt: "2026-08-20T15:00:00+10:00",
      endsAt: null,
      reservationCode: "PRIVATE-CODE",
      paymentStatus: "paid",
      externalUrl: null,
      documentUrl: null,
      memo: "PRIVATE-MEMO",
      isFixed: true
    }
  },
  state: "conflict",
  attempts: 1,
  createdAt: "2026-07-28T10:00:00.000Z",
  lastErrorCode: "VERSION_CONFLICT",
  conflictCurrent: {
    id: "booking-1",
    version: 3,
    provider: "Server Hotel",
    reservationCode: "SERVER-PRIVATE-CODE",
    memo: "SERVER-PRIVATE-MEMO"
  }
};

describe("ConflictDialog", () => {
  it("shows both safe summaries without exposing booking secrets", () => {
    render(
      <ConflictDialog
        record={conflict}
        onKeepMine={vi.fn()}
        onUseLatest={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "동기화 충돌" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "동기화 충돌" })).toBeVisible();
    expect(screen.getByText("내 수정")).toBeVisible();
    expect(screen.getByText("서버 최신 내용")).toBeVisible();
    expect(screen.getByText(/Harbour Hotel/)).toBeVisible();
    expect(screen.getByText(/Server Hotel/)).toBeVisible();
    expect(screen.queryByText(/PRIVATE-CODE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE-MEMO/)).not.toBeInTheDocument();
  });

  it("requires an explicit latest-or-mine choice", async () => {
    const onUseLatest = vi.fn();
    const onKeepMine = vi.fn();
    render(
      <ConflictDialog
        record={conflict}
        onKeepMine={onKeepMine}
        onUseLatest={onUseLatest}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "최신 내용 사용" }));
    await userEvent.click(screen.getByRole("button", { name: "내 수정 유지" }));

    expect(onUseLatest).toHaveBeenCalledTimes(1);
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });
});
