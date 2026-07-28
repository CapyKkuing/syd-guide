import { Theme as AstryxTheme } from "@astryxdesign/core";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import type { ReactNode } from "react";
import { useTheme } from "./ThemeProvider";

export function AstryxThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();

  return (
    <AstryxTheme mode={resolvedTheme} theme={matchaTheme}>
      {children}
    </AstryxTheme>
  );
}
