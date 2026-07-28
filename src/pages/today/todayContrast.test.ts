import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokenStyles = readFileSync("src/styles/tokens.css", "utf8");
const todayStyles = readFileSync("src/styles/today.css", "utf8");

describe("completed Today schedule contrast", () => {
  it("uses opaque semantic tokens instead of whole-item opacity", () => {
    const completedRule = ruleFor(todayStyles, ".today-schedule__item.is-done");

    expect(completedRule).toContain("border-color: var(--today-boundary);");
    expect(completedRule).toContain("background: var(--surface-2);");
    expect(completedRule).toContain("color: var(--text);");
    expect(completedRule).not.toContain("opacity:");
    expect(todayStyles).not.toMatch(
      /\.today-schedule__item\.is-done\s*\{[^}]*opacity:/
    );
  });

  it("links every completed-item foreground and status boundary to passing token ratios", () => {
    expect(ruleFor(
      todayStyles,
      ".today-schedule__item.is-done .today-schedule__time"
    )).toContain("color: var(--text);");
    expect(ruleFor(
      todayStyles,
      ".today-schedule__item.is-done .today-schedule__content > p"
    )).toContain("color: var(--text-2);");
    expect(ruleFor(
      todayStyles,
      ".today-schedule__item.is-done .today-schedule__title"
    )).toContain("color: var(--text) !important;");

    const statusRule = ruleFor(todayStyles, ".today-schedule__status");
    expect(statusRule).toContain("border: 1px solid var(--today-boundary);");
    expect(statusRule).toContain("background: var(--surface);");
    expect(statusRule).toContain("color: var(--text);");

    for (const theme of ["light", "dark"] as const) {
      const completedBackground = tokenValue(theme, "surface-2");
      expect(contrastRatio(
        tokenValue(theme, "today-boundary"),
        completedBackground
      )).toBeGreaterThanOrEqual(3);
      for (const foreground of ["text", "text-2"]) {
        expect(contrastRatio(
          tokenValue(theme, foreground),
          completedBackground
        )).toBeGreaterThanOrEqual(4.5);
      }

      const statusBackground = tokenValue(theme, "surface");
      expect(contrastRatio(
        tokenValue(theme, "today-boundary"),
        statusBackground
      )).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(
        tokenValue(theme, "text"),
        statusBackground
      )).toBeGreaterThanOrEqual(4.5);
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
  const section = tokenStyles.match(
    new RegExp(`:root\\[data-theme="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`)
  );
  const value = section?.[1]?.match(new RegExp(`--${token}: ([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing ${token} token for ${theme}`);
  return value;
}

type Rgb = readonly [number, number, number];

function rgb(value: string): Rgb {
  const channels = value.slice(1).match(/../g)
    ?.map((channel) => Number.parseInt(channel, 16));
  if (!channels || channels.length !== 3) throw new Error(`Invalid colour: ${value}`);
  return [channels[0]!, channels[1]!, channels[2]!];
}

function contrastRatio(first: string, second: string): number {
  const luminance = (value: string) => {
    const normalized = rgb(value)
      .map((channel) => channel / 255)
      .map((channel) => channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * normalized[0]!
      + 0.7152 * normalized[1]!
      + 0.0722 * normalized[2]!;
  };
  const [lighter, darker] = [luminance(first), luminance(second)]
    .sort((left, right) => right - left);
  return (lighter! + 0.05) / (darker! + 0.05);
}
