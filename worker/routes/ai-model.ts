import type { Hono } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../http/errors";

const MODEL_ID = "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k";
const MODEL_REVISION = "3ba07f12712fa58fd6b3d661f9909c9e332c5005";
const ROUTE_PREFIX = "/api/ai-models/";
const ALLOWED_FILES = new Set([
  "config.json",
  "preprocessor_config.json",
  "onnx/model_quantized.onnx",
]);

export type AiModelFetch = typeof fetch;

export function registerAiModelRoutes(
  app: Hono<AppEnv>,
  upstreamFetch: AiModelFetch = fetch
) {
  app.get(`${ROUTE_PREFIX}*`, async (c) => {
    const relativePath = new URL(c.req.url).pathname.slice(ROUTE_PREFIX.length);
    const expectedPrefix = `${MODEL_ID}/resolve/${MODEL_REVISION}/`;
    const file = relativePath.startsWith(expectedPrefix)
      ? relativePath.slice(expectedPrefix.length)
      : "";

    if (!ALLOWED_FILES.has(file)) {
      return apiError(c, 404, "MODEL_FILE_NOT_FOUND", "AI model file not found");
    }

    const upstream = await upstreamFetch(
      `https://huggingface.co/${relativePath}`,
      { redirect: "follow" }
    );
    if (!upstream.ok || !upstream.body) {
      return apiError(c, 502, "MODEL_FETCH_FAILED", "AI model file is unavailable");
    }

    const headers = new Headers({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
    });
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(upstream.body, { headers });
  });
}
