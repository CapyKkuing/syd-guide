import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantSetupGate } from "./ParticipantSetup";

const initialRoster = {
  setupComplete: false,
  representativeMemberId: "owner",
  members: [
    {
      id: "owner",
      displayName: "나",
      isActive: true,
      isRepresentative: true,
      deviceCount: 0,
    },
    {
      id: "partner",
      displayName: "여자친구",
      isActive: true,
      isRepresentative: false,
      deviceCount: 0,
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("participant first setup", () => {
  it("requires names and keeps the owner as the initial representative", async () => {
    const request = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/session") {
        return Response.json({ principal: { memberId: "owner", role: "owner" } });
      }
      if (url === "/api/admin/participants" && !init?.method) {
        return Response.json({ roster: initialRoster });
      }
      if (url === "/api/admin/participants/setup") {
        return Response.json({
          roster: {
            ...initialRoster,
            setupComplete: true,
            members: initialRoster.members.map((member, index) => ({
              ...member,
              displayName: index === 0 ? "연준" : "민지",
            })),
          },
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal("fetch", request);

    render(
      <ParticipantSetupGate>
        <p>여행 서재 내용</p>
      </ParticipantSetupGate>
    );

    expect(await screen.findByRole("heading", { name: "누구와 함께 가나요?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "2명으로 시작하기" })).toBeVisible();
    await userEvent.type(screen.getByLabelText(/내 이름/), "연준");
    await userEvent.type(screen.getByLabelText(/함께 갈 사람 1/), "민지");
    await userEvent.click(screen.getByRole("button", { name: "2명으로 시작하기" }));

    await waitFor(() => expect(screen.getByText("여행 서재 내용")).toBeVisible());
    expect(request).toHaveBeenCalledWith(
      "/api/admin/participants/setup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ownerName: "연준", participantNames: ["민지"] }),
      })
    );
  });
});
