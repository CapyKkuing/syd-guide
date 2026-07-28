import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokenStyles = readFileSync("src/styles/tokens.css", "utf8");
const scheduleStyles = readFileSync("src/styles/schedule.css", "utf8");
const componentStyles = readFileSync("src/styles/components.css", "utf8");

describe("Schedule visual contrast", () => {
  it("uses the shared three-to-one boundary for schedule surfaces and the sheet close control", () => {
    for (const selector of [
      ".schedule-day-selector button",
      ".schedule-summary",
      ".schedule-timeline__card"
    ]) {
      expect(ruleFor(scheduleStyles, selector)).toContain("border: 1px solid var(--today-boundary);");
    }
    expect(ruleFor(componentStyles, ".sheet__close"))
      .toContain("border: 1px solid var(--today-boundary);");

    for (const theme of ["light", "dark"] as const) {
      const boundary = tokenValue(theme, "today-boundary");
      expect(contrastRatio(boundary, tokenValue(theme, "surface"))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(boundary, tokenValue(theme, "bg"))).toBeGreaterThanOrEqual(3);
    }
  });

  const accentSoftForegrounds = [
    {
      content: "selected date day label",
      selector: ".schedule-day-selector button.is-selected",
      token: "text"
    },
    {
      content: "selected date value",
      selector: ".schedule-day-selector button small",
      token: "text-2"
    },
    {
      content: "next card inherited foreground",
      selector: ".schedule-timeline__card",
      token: "text"
    },
    {
      content: "next card time",
      selector: ".schedule-timeline li.is-next .schedule-timeline__card time",
      token: "text"
    },
    {
      content: "next card place and description",
      selector: ".schedule-timeline__content",
      token: "text-2"
    },
    {
      content: "next card title",
      selector: ".schedule-timeline__content strong",
      token: "text"
    },
    {
      content: "next card kind and status",
      selector: ".schedule-timeline li.is-next .schedule-timeline__meta",
      token: "text-2"
    }
  ] as const;

  it.each(accentSoftForegrounds)(
    "keeps $content tied to a four-point-five-to-one foreground on accent-soft",
    ({ selector, token }) => {
      expect(ruleFor(scheduleStyles, selector)).toContain(`color: var(--${token});`);

      for (const theme of ["light", "dark"] as const) {
        const accentSoft = tokenValue(theme, "accent-soft");
        for (const backgroundToken of ["surface", "bg"]) {
          const stateBackground = composite(accentSoft, tokenValue(theme, backgroundToken));
          expect(contrastRatio(tokenValue(theme, token), stateBackground))
            .toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  );

  it("keeps selected and next-state boundaries and the map-link foreground above their required contrasts", () => {
    expect(ruleFor(scheduleStyles, ".schedule-day-selector button.is-selected"))
      .toContain("border-color: var(--accent-strong);");
    expect(ruleFor(scheduleStyles, ".schedule-timeline li.is-next .schedule-timeline__card"))
      .toContain("border-color: var(--accent-strong);");
    expect(ruleFor(scheduleStyles, ".schedule-timeline__meta"))
      .toContain("color: var(--text-3);");

    for (const theme of ["light", "dark"] as const) {
      const accentSoft = tokenValue(theme, "accent-soft");
      for (const background of [tokenValue(theme, "surface"), tokenValue(theme, "bg")]) {
        const stateBackground = composite(accentSoft, background);
        expect(contrastRatio(tokenValue(theme, "accent-strong"), stateBackground))
          .toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(tokenValue(theme, "text-on-accent"), tokenValue(theme, "accent")))
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps completed timeline card boundaries and text contrast intact without whole-card opacity", () => {
    const completedRule = ruleFor(scheduleStyles, ".schedule-timeline li.is-done .schedule-timeline__card");
    expect(completedRule).toContain("border-color: var(--today-boundary);");
    expect(completedRule).toContain("background: var(--surface-2);");
    expect(completedRule).not.toContain("opacity:");

    for (const theme of ["light", "dark"] as const) {
      const completedBackground = tokenValue(theme, "surface-2");
      expect(contrastRatio(tokenValue(theme, "today-boundary"), completedBackground)).toBeGreaterThanOrEqual(3);
      for (const token of ["text", "text-2", "text-3", "accent-strong"]) {
        expect(contrastRatio(tokenValue(theme, token), completedBackground)).toBeGreaterThanOrEqual(4.5);
      }
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

type Rgb = readonly [number, number, number];

function rgb(value: string): Rgb {
  if (value.startsWith("#")) {
    const channels = value.slice(1).match(/../g)?.map((channel) => Number.parseInt(channel, 16));
    if (!channels || channels.length !== 3) throw new Error(`Invalid colour: ${value}`);
    return [channels[0]!, channels[1]!, channels[2]!];
  }
  const match = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(value);
  if (!match) throw new Error(`Invalid colour: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function alpha(value: string): number {
  return Number(/^rgba\([^,]+,\s*[^,]+,\s*[^,]+,\s*([\d.]+)\)$/.exec(value)?.[1] ?? 1);
}

function composite(foreground: string, background: string): string {
  const foregroundRgb = rgb(foreground);
  const backgroundRgb = rgb(background);
  const foregroundAlpha = alpha(foreground);
  const mixed = foregroundRgb.map((channel, index) => (
    channel * foregroundAlpha + backgroundRgb[index]! * (1 - foregroundAlpha)
  ));
  return `rgb(${mixed.join(", ")})`;
}

function contrastRatio(first: string, second: string): number {
  const luminance = (value: string) => {
    const normalized = rgb(value).map((channel) => channel / 255).map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * normalized[0]! + 0.7152 * normalized[1]! + 0.0722 * normalized[2]!;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (lighter! + 0.05) / (darker! + 0.05);
}
