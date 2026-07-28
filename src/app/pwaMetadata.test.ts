// @vitest-environment node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { OutputBundle } from "rollup";
import { resolveConfig } from "vite";
import { describe, expect, it, vi } from "vitest";

type PwaPlugin = {
  name: string;
  api?: {
    // eslint-disable-next-line no-unused-vars -- Vite PWA API callback contract
    generateBundle: (bundle?: OutputBundle) => OutputBundle | undefined;
  };
};

describe("PWA metadata", () => {
  it("ships the approved initial document and manifest colors", async () => {
    const root = process.cwd();
    const indexHtml = await readFile(resolve(root, "index.html"), "utf8");
    const resolvedConfig = await resolveConfig(
      { configFile: resolve(root, "vite.config.ts") },
      "build",
      "production"
    );
    const pwaPlugin = resolvedConfig.plugins.find(
      (plugin): plugin is PwaPlugin => plugin.name === "vite-plugin-pwa"
    );
    const bundle: OutputBundle = {};
    const generatedBundle = pwaPlugin?.api?.generateBundle(bundle);
    const manifestAsset = generatedBundle?.["manifest.webmanifest"];

    expect(indexHtml).toContain('<meta name="theme-color" content="#F6F7F8">');
    expect(indexHtml).toContain(
      '<meta name="description" content="둘만의 여행을 오늘 중심으로 확인하는 개인용 여행 가이드북">'
    );
    expect(manifestAsset).toMatchObject({
      type: "asset",
      source: expect.any(String)
    });

    const manifest = JSON.parse(String((manifestAsset as { source: string }).source));
    expect(manifest).toMatchObject({
      background_color: "#F6F7F8",
      theme_color: "#0C7892"
    });
  });

  it("packages the exact GitHub Pages app as a deep-link fallback under its repository base", async () => {
    const root = process.cwd();
    const resolvedConfig = await resolveConfig(
      { configFile: resolve(root, "vite.config.ts"), mode: "github-pages" },
      "build",
      "github-pages"
    );
    const fallbackPlugin = resolvedConfig.plugins.find(
      (plugin) => plugin.name === "pages-spa-fallback"
    );
    const emitFile = vi.fn(() => "404-reference");
    const indexSource = "<!doctype html><script src=\"/syd-guide/assets/app.js\"></script>";
    const bundle: OutputBundle = {
      "index.html": {
        type: "asset",
        fileName: "index.html",
        name: undefined,
        names: [],
        originalFileName: null,
        originalFileNames: [],
        source: indexSource,
        needsCodeReference: false
      }
    };

    expect(resolvedConfig.base).toBe("/syd-guide/");
    expect(fallbackPlugin?.generateBundle).toBeTypeOf("object");
    const generateBundle = fallbackPlugin?.generateBundle;
    if (!generateBundle || typeof generateBundle === "function") {
      throw new Error("Expected the Pages fallback object hook");
    }
    /* eslint-disable no-unused-vars -- declaration mirrors the bundler hook boundary */
    const handler = generateBundle.handler as unknown as (
      this: { emitFile: (asset: unknown) => string },
      options: unknown,
      output: OutputBundle,
      isWrite: boolean
    ) => void;
    /* eslint-enable no-unused-vars */
    handler.call({ emitFile }, {}, bundle, false);
    expect(emitFile).toHaveBeenCalledWith({
      type: "asset",
      fileName: "404.html",
      source: indexSource
    });
  });
});
