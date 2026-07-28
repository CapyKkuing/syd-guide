import type { ResolvedTheme, ThemePreference } from "./types";

export const THEME_STORAGE_KEY = "theme";

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#F6F7F8",
  dark: "#081018"
};

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean
): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  document.documentElement.dataset.theme = resolvedTheme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[resolvedTheme]);
}
