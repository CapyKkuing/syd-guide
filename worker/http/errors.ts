import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorBody } from "../../src/shared/api";
import type { AppEnv } from "../env";

export function apiError(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: unknown
) {
  const error: ApiErrorBody["error"] =
    details === undefined ? { code, message } : { code, message, details };

  return c.json({ error }, status);
}
