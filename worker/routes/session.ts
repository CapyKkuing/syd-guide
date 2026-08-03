import type { Hono } from "hono";
import type { AppDependencies } from "../auth/access";
import { clearSessionCookie } from "../auth/cookie";
import { requirePrincipal } from "../auth/principal";
import { revokeSession } from "../auth/session";
import type { AppEnv } from "../env";

function safeContinuePath(value: string | undefined) {
  if (!value) return null;
  const target = new URL(value, "https://app.invalid");
  if (target.origin !== "https://app.invalid") return null;
  return `${target.pathname}${target.search}${target.hash}`;
}

export function registerSessionRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies
) {
  app.get("/api/session", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    const continueTo = safeContinuePath(c.req.query("continue"));
    if (continueTo) return c.redirect(continueTo);
    return c.json({ principal });
  });

  app.post("/api/session/logout", async (c) => {
    const principal = await requirePrincipal(c, dependencies);
    if (principal.sessionId) {
      await revokeSession(c.env, principal.sessionId, dependencies.now());
    }
    return c.body(null, 204, { "Set-Cookie": clearSessionCookie() });
  });
}
