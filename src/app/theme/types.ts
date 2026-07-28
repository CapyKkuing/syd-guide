export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  // eslint-disable-next-line no-unused-vars -- callback contract parameter
  setPreference: (preference: ThemePreference) => void;
}
