import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("serves API health before static assets", async () => {
  const response = await exports.default.fetch(
    new Request("https://example.test/api/health")
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});

it("keeps unknown API routes out of the SPA fallback", async () => {
  const response = await exports.default.fetch(
    new Request("https://example.test/api/missing")
  );

  expect(response.status).toBe(404);
  await expect(response.json()).resolves.toEqual({
    error: {
      code: "NOT_FOUND",
      message: "API route not found"
    }
  });
});
