import type { Principal } from "../../src/shared/entities";
import type { Env } from "../env";
import { readSessionCookie } from "./cookie";
import { hashToken } from "./hash";

export type SessionErrorCode =
  | "SESSION_REQUIRED"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED";

type SessionRow = {
  id: string;
  member_id: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export type PartnerSessionResult =
  | { ok: true; principal: Principal }
  | { ok: false; code: SessionErrorCode };

const DAY = 24 * 60 * 60 * 1000;
const SESSION_LIFETIME = 90 * DAY;

export async function resolvePartnerSession(
  request: Request,
  env: Env,
  now: Date
): Promise<PartnerSessionResult> {
  const token = readSessionCookie(request);
  if (!token) return { ok: false, code: "SESSION_REQUIRED" };

  const session = await env.DB.prepare(
    "SELECT id, member_id, last_seen_at, expires_at, revoked_at FROM device_sessions WHERE token_hash = ? AND member_id = 'partner'"
  )
    .bind(await hashToken(token))
    .first<SessionRow>();
  if (!session) return { ok: false, code: "SESSION_REQUIRED" };
  if (session.revoked_at) return { ok: false, code: "SESSION_REVOKED" };
  const expiresAt = Date.parse(session.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return { ok: false, code: "SESSION_EXPIRED" };
  }

  const lastSeenAt = Date.parse(session.last_seen_at);
  if (!Number.isFinite(lastSeenAt) || now.getTime() - lastSeenAt > DAY) {
    await env.DB.prepare(
      "UPDATE device_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?"
    )
      .bind(
        now.toISOString(),
        new Date(now.getTime() + SESSION_LIFETIME).toISOString(),
        session.id
      )
      .run();
  }
  return {
    ok: true,
    principal: {
      memberId: session.member_id,
      role: "partner",
      sessionId: session.id,
    },
  };
}

export async function revokeSession(env: Env, sessionId: string, now: Date) {
  await env.DB.prepare(
    "UPDATE device_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL"
  )
    .bind(now.toISOString(), sessionId)
    .run();
}
