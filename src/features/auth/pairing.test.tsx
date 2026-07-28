import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumePairTokenFromUrl, navigate, useRoute } from "../../app/router";
import { DeviceList } from "./DeviceList";
import { InvitePanel } from "./InvitePanel";
import { PairDevicePage } from "./PairDevicePage";
import { PairingManager } from "./PairingManager";

const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock("qrcode", () => ({ default: qr }));

function RouteProbe() {
  const route = useRoute();
  if (route.name !== "trip") return <span>{route.name}</span>;
  return <span>{`${route.name}/${route.tripId}/${route.tab}`}</span>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  qr.toDataURL.mockReset();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("device pairing UI", () => {
  it("uses one invite URL for both the QR and copy field", async () => {
    const url = "https://partner.example/pair?token=one-time-token";
    qr.toDataURL.mockResolvedValue("data:image/png;base64,qr");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          invite: { url, token: "sample", expiresAt: new Date(Date.now() + 600_000).toISOString() },
        }, { status: 201 })
      )
    );

    render(<InvitePanel />);
    await userEvent.click(screen.getByRole("button", { name: "초대 만들기" }));

    expect(await screen.findByRole("img", { name: "파트너 연결 QR 코드" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "초대 링크" })).toHaveValue(url);
    expect(qr.toDataURL).toHaveBeenCalledWith(url, { width: 240, margin: 1 });
  });

  it("removes the token from the address before claiming the device", async () => {
    window.history.replaceState(null, "", "/pair?token=claim-token");
    const token = consumePairTokenFromUrl();
    const request = vi.fn().mockResolvedValue(
      Response.json({ redirectTo: "/library" })
    );
    vi.stubGlobal("fetch", request);

    render(<PairDevicePage token={token} />);
    expect(window.location.pathname).toBe("/pair");
    expect(window.location.search).toBe("");

    await userEvent.type(screen.getByLabelText("이 기기 이름"), "연준 iPhone");
    await userEvent.click(screen.getByRole("button", { name: "기기 연결" }));

    await waitFor(() => expect(window.location.pathname).toBe("/library"));
    expect(request).toHaveBeenCalledWith(
      "/api/pair/claim",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "claim-token", deviceName: "연준 iPhone" }),
      })
    );
  });

  it.each([
    ["/pair?token=canonical", "/", "canonical", "/pair"],
    ["/pair/?token=trailing", "/", "trailing", "/pair"],
    ["/syd-guide/pair?token=based", "/syd-guide/", "based", "/syd-guide/pair"],
    ["/syd-guide/pair/?token=based-trailing", "/syd-guide/", "based-trailing", "/syd-guide/pair"]
  ])("consumes and scrubs a token from %s", (url, base, expectedToken, canonicalPath) => {
    window.history.replaceState(null, "", `${url}&return=%2Flibrary#secret`);

    expect(consumePairTokenFromUrl(base)).toBe(expectedToken);
    expect(window.location.pathname).toBe(canonicalPath);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it.each([
    ["/library?token=keep-me", "/"],
    ["/pairing?token=keep-me", "/"],
    ["/syd-guide/library?token=keep-me", "/syd-guide/"],
    ["/other/pair?token=keep-me", "/syd-guide/"]
  ])("does not consume a token from non-pair path %s", (url, base) => {
    window.history.replaceState(null, "", url);

    expect(consumePairTokenFromUrl(base)).toBeNull();
    expect(window.location.pathname + window.location.search).toBe(url);
  });

  it("shows device status without rendering stored secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          devices: [{
            id: "device-1",
            deviceName: "Galaxy",
            lastSeenAt: "2026-07-27T00:00:00.000Z",
            expiresAt: "2026-10-25T00:00:00.000Z",
            revokedAt: null,
            createdAt: "2026-07-27T00:00:00.000Z",
            tokenHash: "must-not-render",
          }],
        })
      )
    );

    render(<DeviceList />);
    expect(await screen.findByText("Galaxy")).toBeVisible();
    expect(screen.queryByText("must-not-render")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "연결 해제" })).toBeVisible();
  });

  it("hides device administration from a partner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          principal: { memberId: "partner", role: "partner", sessionId: "device-1" },
        })
      )
    );

    render(<PairingManager />);
    expect(await screen.findByText("기기 관리는 관리자 전용")).toBeVisible();
    expect(screen.queryByRole("button", { name: "초대 만들기" })).not.toBeInTheDocument();
  });

  it("keeps path navigation working after the pair redirect", () => {
    window.history.replaceState(null, "", "/library");
    render(<RouteProbe />);
    act(() => navigate("/trip/sydney-2026/tools"));
    expect(screen.getByText("trip/sydney-2026/tools")).toBeVisible();
  });
});
