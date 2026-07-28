// @vitest-environment node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Trip Control token names", () => {
  it("keeps semantic accent tokens while excluding retired color aliases", async () => {
    const tokens = await readFile(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
    const retiredAliases = ["te" + "al", "te" + "al-dark"].map((name) => `--${name}:`);

    expect(tokens).toMatch(/--accent:/);
    expect(tokens).toMatch(/--accent-strong:/);
    for (const alias of retiredAliases) {
      expect(tokens).not.toContain(alias);
    }
  });
});
