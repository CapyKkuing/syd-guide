import { Hono } from "hono";
import type { AppEnv } from "./env";
import { apiError } from "./http/errors";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.all("/api/*", (c) =>
    apiError(c, 404, "NOT_FOUND", "API route not found")
  );
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}
