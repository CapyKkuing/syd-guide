import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokenStyles = readFileSync("src/styles/tokens.css", "utf8");
const toolsStyles = readFileSync("src/styles/tools.css", "utf8");
const pairingStyles = readFileSync("src/styles/pairing.css", "utf8");
const componentStyles = readFileSync("src/styles/components.css", "utf8");

describe("Tools and pairing control contrast", () => {
  it("uses the shared accessible boundary for every changed tool and pairing surface", () => {
    for (const [styles, selector, declaration] of [
      [toolsStyles, ".tool-card", "border: 1px solid var(--today-boundary);"],
      [toolsStyles, ".tool-status", "border: 1px solid var(--today-boundary);"],
      [pairingStyles, ".pair-card", "border: 1px solid var(--today-boundary);"],
      [pairingStyles, ".pair-card input", "border: 1px solid var(--today-boundary);"],
      [pairingStyles, ".secondary-button", "border: 1px solid var(--today-boundary);"],
      [pairingStyles, ".device-list li", "border-top: 1px solid var(--today-boundary);"]
    ] as const) {
      expect(lastRuleFor(styles, selector)).toContain(declaration);
    }

    for (const theme of ["light", "dark"] as const) {
      for (const background of ["surface", "bg"] as const) {
        expect(contrastRatio(tokenValue(theme, "today-boundary"), tokenValue(theme, background)))
          .toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("uses an accessible danger foreground for pairing status and destructive controls", () => {
    expect(ruleFor(pairingStyles, ".form-status")).toContain("color: var(--danger-text);");
    expect(lastRuleFor(pairingStyles, ".text-button")).toContain("color: var(--danger-text);");
    expect(ruleFor(pairingStyles, ".revoked-label")).toContain("color: var(--danger-text) !important;");

    for (const theme of ["light", "dark"] as const) {
      expect(contrastRatio(tokenValue(theme, "danger-text"), tokenValue(theme, "surface")))
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it("defines disabled controls without opacity and with explicit accessible values", () => {
    const disabledRule = ruleFor(componentStyles, ".primary-button:disabled,\n.secondary-button:disabled");
    expect(disabledRule).toContain("cursor: not-allowed;");
    expect(disabledRule).toContain("border-color: var(--disabled-border);");
    expect(disabledRule).toContain("background: var(--disabled-bg);");
    expect(disabledRule).toContain("color: var(--disabled-text);");
    expect(disabledRule).not.toContain("opacity:");
    expect(pairingStyles).not.toContain("button:disabled");

    for (const theme of ["light", "dark"] as const) {
      expect(contrastRatio(tokenValue(theme, "disabled-text"), tokenValue(theme, "disabled-bg")))
        .toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokenValue(theme, "disabled-border"), tokenValue(theme, "disabled-bg")))
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

function lastRuleFor(styles: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rules = [...styles.matchAll(new RegExp(`(?:^|\\n)${escaped} \\{([\\s\\S]*?)\\n\\}`, "g"))];
  const rule = rules.at(-1)?.[1];
  if (!rule) throw new Error(`Missing CSS rule for ${selector}`);
  return rule;
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
    const linear = channels.map((channel) => channel / 255).map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (lighter! + 0.05) / (darker! + 0.05);
}
