import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mapSnapshotToWorkspace } from "../../../data/api/snapshotMappers";
import { createTripSnapshot } from "../../../test/snapshotSamples";
import { AiLauncher } from "./AiLauncher";
import { buildAiPrompt } from "./prompt";

function createWorkspace() {
  const snapshot = createTripSnapshot();
  snapshot.bookings[0]!.reservationCode = "ABC12345";
  snapshot.bookings[0]!.memo = "창가 요청";
  snapshot.notes = [
    {
      id: "note-personal",
      tripId: snapshot.trip.id,
      targetType: "trip",
      targetId: null,
      visibility: "personal",
      authorMemberId: "owner",
      body: "개인 메모",
      attachmentUrl: null,
      version: 1,
      updatedAt: "2026-09-09T00:00:00.000Z",
      updatedBy: "owner"
    },
    {
      id: "note-shared",
      tripId: snapshot.trip.id,
      targetType: "trip",
      targetId: null,
      visibility: "shared",
      authorMemberId: "owner",
      body: "우산 챙기기",
      attachmentUrl: null,
      version: 1,
      updatedAt: "2026-09-09T00:00:00.000Z",
      updatedBy: "owner"
    }
  ];
  return mapSnapshotToWorkspace(
    snapshot,
    { memberId: "owner", role: "owner" },
    new Date("2026-09-10T02:00:00.000Z")
  );
}

describe("AI launcher", () => {
  it("excludes reservation codes, booking memos, and personal notes from every prompt scope", () => {
    const workspace = createWorkspace();
    const selections = [
      { scope: "trip" as const, selectedId: null },
      { scope: "today" as const, selectedId: null },
      { scope: "place" as const, selectedId: "place-opera" }
    ];

    for (const selection of selections) {
      const prompt = buildAiPrompt(workspace, selection);
      expect(prompt).not.toContain("ABC12345");
      expect(prompt).not.toContain("창가 요청");
      expect(prompt).not.toContain("개인 메모");
    }
    expect(buildAiPrompt(workspace, selections[0]!)).toContain("우산 챙기기");
    expect(buildAiPrompt(workspace, selections[2]!)).toContain("Sydney Opera House");
  });

  it("loads and saves the provider through local settings only", async () => {
    const settings = {
      get: vi.fn().mockResolvedValue("gemini"),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const localStorageSet = vi.spyOn(Storage.prototype, "setItem");

    render(<AiLauncher settings={settings} workspace={createWorkspace()} />);

    expect(await screen.findByLabelText("AI 공급자")).toHaveValue("gemini");
    await userEvent.selectOptions(screen.getByLabelText("AI 공급자"), "chatgpt");

    await waitFor(() => {
      expect(settings.set).toHaveBeenCalledWith("ai-provider", "chatgpt");
    });
    expect(localStorageSet).not.toHaveBeenCalled();
  });

  it("opens the provider before copying and never stores prompt history", async () => {
    const events: string[] = [];
    const settings = {
      get: vi.fn().mockResolvedValue("chatgpt"),
      set: vi.fn().mockResolvedValue(undefined)
    };
    const openProvider = vi.fn(() => {
      events.push("open");
      return window;
    });
    const copyPrompt = vi.fn(async () => {
      events.push("copy");
    });

    render(
      <AiLauncher
        copyPrompt={copyPrompt}
        openProvider={openProvider}
        settings={settings}
        workspace={createWorkspace()}
      />
    );
    await screen.findByLabelText("AI 공급자");
    await userEvent.click(screen.getByRole("button", { name: "AI에서 질문하기" }));

    expect(events).toEqual(["open", "copy"]);
    expect(openProvider).toHaveBeenCalledWith("https://chatgpt.com/");
    expect(copyPrompt).toHaveBeenCalledWith(expect.stringContaining("시드니 여행"));
    expect(settings.set).not.toHaveBeenCalledWith(
      expect.stringMatching(/prompt/i),
      expect.anything()
    );
  });

  it("shows a readonly prompt and safe provider link when browser actions fail", async () => {
    const settings = {
      get: vi.fn().mockResolvedValue("gemini"),
      set: vi.fn().mockResolvedValue(undefined)
    };

    render(
      <AiLauncher
        copyPrompt={vi.fn().mockRejectedValue(new Error("blocked"))}
        openProvider={vi.fn(() => null)}
        settings={settings}
        workspace={createWorkspace()}
      />
    );
    expect(await screen.findByLabelText("AI 공급자")).toHaveValue("gemini");
    await userEvent.click(screen.getByRole("button", { name: "AI에서 질문하기" }));

    const prompt = await screen.findByLabelText("복사할 질문");
    expect(prompt).toHaveAttribute("readonly");
    expect(prompt).not.toHaveValue(expect.stringContaining("ABC12345"));
    const fallback = screen.getByRole("link", { name: "Gemini 열기" });
    expect(fallback).toHaveAttribute("href", "https://gemini.google.com/app");
    expect(fallback).toHaveAttribute("target", "_blank");
    expect(fallback).toHaveAttribute("rel", "noopener noreferrer");
  });
});
