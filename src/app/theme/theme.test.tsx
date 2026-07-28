import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeControl } from "./ThemeControl";
import { ThemeProvider, useTheme } from "./ThemeProvider";

// eslint-disable-next-line no-unused-vars -- MediaQueryList listener contract
const themeListeners = new Set<(event: MediaQueryListEvent) => void>();
const matchMediaMock = {
  matches: false,
  media: "(prefers-color-scheme: dark)",
  onchange: null,
  // eslint-disable-next-line no-unused-vars -- MediaQueryList listener contract
  addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
    themeListeners.add(listener),
  // eslint-disable-next-line no-unused-vars -- MediaQueryList listener contract
  removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
    themeListeners.delete(listener),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn()
};

function ThemeProbe() {
  const { preference, resolvedTheme } = useTheme();

  return <output>{`${preference}/${resolvedTheme}`}</output>;
}

beforeEach(() => {
  localStorage.clear();
  themeListeners.clear();
  matchMediaMock.matches = false;
  document.head.innerHTML = '<meta name="theme-color" content="#0b6b67">';
  vi.stubGlobal("matchMedia", vi.fn(() => matchMediaMock));
});

describe("ThemeProvider", () => {
  it("uses system by default and applies the resolved theme", () => {
    matchMediaMock.matches = true;

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByText("system/dark")).toBeVisible();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#081018"
    );
  });

  it("uses system when storage contains an invalid preference", () => {
    localStorage.setItem("theme", "sepia");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(screen.getByText("system/light")).toBeVisible();
  });

  it("stores an explicit choice and updates theme-color", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>
    );

    await user.click(screen.getByRole("radio", { name: "라이트" }));

    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#F6F7F8"
    );
  });

  it("updates theme-color when an explicit dark preference resolves", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>
    );

    await user.click(screen.getByRole("radio", { name: "다크" }));

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#081018"
    );
  });

  it("lets keyboard users select a theme radio", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>
    );

    const darkRadio = screen.getByRole("radio", { name: "다크" });
    darkRadio.focus();
    await user.keyboard("[Space]");

    expect(darkRadio).toBeChecked();
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("gives each theme choice a 44px touch target", () => {
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>
    );

    const lightLabel = screen.getByRole("radio", { name: "라이트" }).closest("label");

    expect(lightLabel).not.toBeNull();
    expect(getComputedStyle(lightLabel!).minHeight).toBe("44px");
  });

  it("updates theme-color when System follows an OS change", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#F6F7F8"
    );

    act(() => {
      for (const listener of themeListeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#081018"
    );
  });
});
