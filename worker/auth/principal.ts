import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Principal } from "../../src/shared/entities";
import type { AppEnv } from "../env";
import {
  defaultDependencies,
  type AppDependencies,
} from "./access";
import { readDevPrincipal } from "./dev";
import { constantTimeEqual } from "./hash";
import { resolvePartnerSession } from "./session";

export class AuthError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function requirePrincipal(
  c: Context<AppEnv>,
  dependencies: AppDependencies = defaultDependencies
): Promise<Principal> {
  const dev = readDevPrincipal(c.req.raw, c.env);
  if (dev.used) {
    if (dev.principal) return dev.principal;
    throw new AuthError(401, "ACCESS_REQUIRED", "Authentication required");
  }

  if (c.env.SURFACE === "partner") {
    const result = await resolvePartnerSession(
      c.req.raw,
      c.env,
      dependencies.now()
    );
    if (result.ok) return result.principal;
    throw new AuthError(401, result.code, "Device session is not valid");
  }

  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) {
    throw new AuthError(401, "ACCESS_REQUIRED", "Cloudflare Access required");
  }
  try {
    const claims = await dependencies.accessVerifier.verify(token, c.env);
    const email = claims.email.trim().toLowerCase();
    if (
      !c.env.ADMIN_EMAIL ||
      !(await constantTimeEqual(email, c.env.ADMIN_EMAIL.trim().toLowerCase()))
    ) {
      throw new AuthError(403, "ACCESS_DENIED", "Owner access denied");
    }
    await c.env.DB.prepare(
      "UPDATE members SET access_email = ? WHERE id = 'owner'"
    )
      .bind(email)
      .run();
    return { memberId: "owner", role: "owner" };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(401, "ACCESS_INVALID", "Cloudflare Access is invalid");
  }
}

export async function requireOwner(
  c: Context<AppEnv>,
  dependencies: AppDependencies = defaultDependencies
) {
  const principal = await requirePrincipal(c, dependencies);
  if (principal.role !== "owner") {
    throw new AuthError(403, "OWNER_REQUIRED", "Owner access required");
  }
  return principal;
}
