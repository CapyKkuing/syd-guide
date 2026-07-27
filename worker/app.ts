import { Hono } from "hono";
import {
  defaultDependencies,
  type AppDependencies,
} from "./auth/access";
import { requireSameOrigin } from "./auth/origin";
import { AuthError } from "./auth/principal";
import type { AppEnv } from "./env";
import { apiError } from "./http/errors";
import { registerSessionRoutes } from "./routes/session";

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const app = new Hono<AppEnv>();
  const dependencies = { ...defaultDependencies, ...overrides };

  app.use("/api/*", requireSameOrigin);
  app.get("/api/health", (c) => c.json({ ok: true }));
  registerSessionRoutes(app, dependencies);
  app.all("/api/*", (c) =>
    apiError(c, 404, "NOT_FOUND", "API route not found")
  );
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
  app.onError((error, c) => {
    if (error instanceof AuthError) {
      return apiError(c, error.status, error.code, error.message);
    }
    throw error;
  });

  return app;
}
