import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantSetupGate } from "./ParticipantSetup";
import { ParticipantManager } from "./ParticipantManager";

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
  it("shows reconnect guidance and retries an invalid device session", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({
        error: { code: "SESSION_REVOKED", message: "Device session is not valid" },
      }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({
        principal: { memberId: "partner", role: "partner" },
      }));
    vi.stubGlobal("fetch", request);

    render(
      <ParticipantSetupGate>
        <p>여행 서재 내용</p>
      </ParticipantSetupGate>
    );

    expect(await screen.findByRole("heading", { name: "기기 연결이 필요합니다" }))
      .toBeVisible();
    expect(screen.getByText(/관리자에게 새 연결 링크를 요청/)).toBeVisible();
    expect(screen.queryByText("Device session is not valid")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "다시 확인" }));

    expect(await screen.findByText("여행 서재 내용")).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("allows the administrator to start alone", async () => {
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
          roster: { ...initialRoster, setupComplete: true },
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

    expect(await screen.findByRole("button", { name: "1명으로 시작하기" })).toBeVisible();
    await userEvent.type(screen.getByLabelText(/내 이름/), "연준");
    await userEvent.click(screen.getByRole("button", { name: "1명으로 시작하기" }));

    await waitFor(() => expect(screen.getByText("여행 서재 내용")).toBeVisible());
    expect(request).toHaveBeenCalledWith(
      "/api/admin/participants/setup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ownerName: "연준", participantNames: [] }),
      })
    );
  });

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
    await userEvent.click(screen.getByRole("button", { name: "함께 갈 사람 추가" }));
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

describe("participant management", () => {
  it("requires confirmation before removing a participant", async () => {
    const updatedRoster = {
      ...initialRoster,
      setupComplete: true,
      members: initialRoster.members.map((member) =>
        member.id === "partner" ? { ...member, isActive: false } : member
      ),
    };
    const request = vi.fn().mockResolvedValue(Response.json({ roster: updatedRoster }));
    const onChange = vi.fn();
    vi.stubGlobal("fetch", request);

    render(<ParticipantManager roster={initialRoster} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "여자친구 삭제" }));
    const confirmRemoval = await screen.findByRole("button", { name: "여자친구 삭제 확인" });
    expect(confirmRemoval).toBeVisible();
    await userEvent.click(confirmRemoval);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(updatedRoster));
    expect(request).toHaveBeenCalledWith(
      "/api/admin/participants/partner",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(screen.queryByRole("button", { name: "나 삭제" })).not.toBeInTheDocument();
  });
});
