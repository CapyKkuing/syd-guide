import { env } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../worker/app";
import type { Env } from "../../worker/env";

const revision = "3ba07f12712fa58fd6b3d661f9909c9e332c5005";
const modelPath = `onnx-community/mobilenetv4_conv_small.e2400_r224_in1k/resolve/${revision}`;

function bindings(): Env {
  return {
    ...env,
    SURFACE: "admin",
    APP_ORIGIN: "https://example.test",
  };
}

describe("local AI model boundary", () => {
  it("streams an approved model file through the app origin", async () => {
    const aiModelFetch = vi.fn(async () => new Response("model-config", {
      headers: { "Content-Type": "application/json" },
    }));
    const app = createApp({ aiModelFetch });

    const response = await app.request(
      `https://example.test/api/ai-models/${modelPath}/config.json`,
      undefined,
      bindings()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
    await expect(response.text()).resolves.toBe("model-config");
    expect(aiModelFetch).toHaveBeenCalledWith(
      `https://huggingface.co/${modelPath}/config.json`,
      { redirect: "follow" }
    );
  });

  it("does not expose an open model proxy", async () => {
    const aiModelFetch = vi.fn();
    const app = createApp({ aiModelFetch });

    const response = await app.request(
      "https://example.test/api/ai-models/other/model/resolve/main/config.json",
      undefined,
      bindings()
    );

    expect(response.status).toBe(404);
    expect(aiModelFetch).not.toHaveBeenCalled();
  });
});
