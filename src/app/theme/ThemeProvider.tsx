/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { applyResolvedTheme, resolveTheme, THEME_STORAGE_KEY } from "./theme";
import type { ThemeContextValue, ThemePreference } from "./types";

const ThemeContext = createContext<ThemeContextValue | null>(null);
const systemColorScheme = "(prefers-color-scheme: dark)";

function getStoredPreference(): ThemePreference {
  const preference = localStorage.getItem(THEME_STORAGE_KEY);

  return preference === "light" || preference === "dark" || preference === "system"
    ? preference
    : "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setStoredPreference] = useState<ThemePreference>(getStoredPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(systemColorScheme).matches);
  const resolvedTheme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const mediaQuery = window.matchMedia(systemColorScheme);
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useLayoutEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setStoredPreference(nextPreference);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);

  if (theme === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return theme;
}
