import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokenStyles = readFileSync("src/styles/tokens.css", "utf8");
const mapStyles = readFileSync("src/styles/map.css", "utf8");

describe("Map filter contrast", () => {
  it("uses the shared three-to-one boundary token in both themes", () => {
    expect(ruleFor(mapStyles, ".map-filters")).toContain("border: 1px solid var(--today-boundary);");

    for (const theme of ["light", "dark"] as const) {
      expect(contrastRatio(tokenValue(theme, "today-boundary"), tokenValue(theme, "surface")))
        .toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tokenValue(theme, "today-boundary"), tokenValue(theme, "bg")))
        .toBeGreaterThanOrEqual(3);
    }
  });
});

function ruleFor(styles: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`(?:^|\\n)${escaped} \\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

function tokenValue(theme: "light" | "dark", token: string): string {
  const section = tokenStyles.match(new RegExp(`:root\\[data-theme="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`));
  const value = section?.[1]?.match(new RegExp(`--${token}: ([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing ${token} token for ${theme}`);
  return value;
}

function contrastRatio(first: string, second: string): number {
  const luminance = (value: string) => {
    const channels = value.slice(1).match(/../g)?.map((channel) => Number.parseInt(channel, 16));
    if (!channels || channels.length !== 3) throw new Error(`Invalid colour: ${value}`);
    const converted = channels.map((channel) => channel / 255).map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * converted[0]! + 0.7152 * converted[1]! + 0.0722 * converted[2]!;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (lighter! + 0.05) / (darker! + 0.05);
}
