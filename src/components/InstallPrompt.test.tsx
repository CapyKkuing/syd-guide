import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallPrompt } from "./InstallPrompt";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function displayMode(standalone: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: standalone,
    media: "(display-mode: standalone)",
  }));
}

describe("InstallPrompt", () => {
  it("defers the browser install prompt until the user chooses 앱 설치", async () => {
    displayMode(false);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: "accepted" }) },
    });
    render(<InstallPrompt />);

    act(() => window.dispatchEvent(event));
    const button = await screen.findByRole("button", { name: "앱 설치" });
    expect(event.defaultPrevented).toBe(true);
    await userEvent.click(button);

    expect(prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "앱 설치" })).not.toBeInTheDocument();
    });
  });

  it("shows the iPhone home-screen instruction outside standalone mode", () => {
    displayMode(false);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone)");

    render(<InstallPrompt />);

    expect(screen.getByText("공유 → 홈 화면에 추가")).toBeVisible();
  });

  it("hides installation guidance when already running standalone", () => {
    displayMode(true);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone)");

    const { container } = render(<InstallPrompt />);

    expect(container).toBeEmptyDOMElement();
  });
});
