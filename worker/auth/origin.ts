import type { Context, Next } from "hono";
import type { AppEnv } from "../env";
import { apiError } from "../http/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function requireSameOrigin(c: Context<AppEnv>, next: Next) {
  if (SAFE_METHODS.has(c.req.method)) return next();

  const origin = c.req.header("Origin");
  if (!origin || origin !== new URL(c.req.url).origin) {
    return apiError(
      c,
      403,
      "ORIGIN_REJECTED",
      "Request origin is not allowed"
    );
  }
  return next();
}
