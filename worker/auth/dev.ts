import type { Principal } from "../../src/shared/entities";
import type { Env } from "../env";

export type DevPrincipalResult =
  | { used: false }
  | { used: true; principal: Principal | null };

export function readDevPrincipal(
  request: Request,
  env: Env
): DevPrincipalResult {
  const value = request.headers.get("X-Dev-Principal");
  if (!value) return { used: false };

  const hostname = new URL(request.url).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (env.DEV_AUTH !== "enabled" || !local) {
    return { used: true, principal: null };
  }
  if (value === "owner") {
    return { used: true, principal: { memberId: "owner", role: "owner" } };
  }
  if (value === "partner") {
    return { used: true, principal: { memberId: "partner", role: "partner" } };
  }
  return { used: true, principal: null };
}
