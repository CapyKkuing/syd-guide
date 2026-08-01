import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("serves API health before static assets", async () => {
  const response = await exports.default.fetch(
    new Request("https://example.test/api/health")
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("content-security-policy")).toContain(
    "connect-src 'self' https://accounts.google.com https://www.googleapis.com"
  );
  expect(response.headers.get("content-security-policy")).toContain(
    "https://cdn.jsdelivr.net https://open.er-api.com"
  );
  expect(response.headers.get("content-security-policy")).toContain(
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com https://cdn.jsdelivr.net"
  );
  expect(response.headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin"
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
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
