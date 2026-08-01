import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Env } from "../env";
import { sessionCookie } from "../auth/cookie";
import { hashToken, randomToken } from "../auth/hash";

export interface IssuedInvite {
  url: string;
  token: string;
  expiresAt: string;
}

export interface ClaimedInvite {
  cookie: string;
  redirectTo: "/library";
}

type InviteRow = {
  id: string;
  member_id: string;
  expires_at: string;
  used_at: string | null;
};

export class PairingError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const INVITE_LIFETIME = 10 * 60 * 1000;
const SESSION_LIFETIME = 90 * 24 * 60 * 60 * 1000;

export async function issueInvite(
  env: Env,
  memberId: string,
  now: Date
): Promise<IssuedInvite> {
  if (!env.PARTNER_ORIGIN) {
    throw new PairingError(500, "PAIRING_NOT_CONFIGURED", "Pairing is not configured");
  }
  const token = randomToken();
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + INVITE_LIFETIME).toISOString();
  await env.DB.prepare(
    "INSERT INTO pair_invites (id, token_hash, created_by, expires_at, used_at, created_at, member_id) VALUES (?, ?, 'owner', ?, NULL, ?, ?)"
  )
    .bind(id, await hashToken(token), expiresAt, now.toISOString(), memberId)
    .run();

  const url = new URL("/pair", env.PARTNER_ORIGIN);
  url.searchParams.set("token", token);
  return { url: url.toString(), token, expiresAt };
}

export async function claimInvite(
  env: Env,
  token: string,
  deviceName: string,
  now: Date
): Promise<ClaimedInvite> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new PairingError(410, "INVITE_INVALID", "Invite is not valid");
  }
  const tokenHash = await hashToken(token);
  const invite = await env.DB.prepare(
    "SELECT id, member_id, expires_at, used_at FROM pair_invites WHERE token_hash = ?"
  )
    .bind(tokenHash)
    .first<InviteRow>();
  if (!invite) {
    throw new PairingError(410, "INVITE_INVALID", "Invite is not valid");
  }
  if (invite.used_at) {
    throw new PairingError(410, "INVITE_ALREADY_USED", "Invite was already used");
  }
  const expiresAt = Date.parse(invite.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    throw new PairingError(410, "INVITE_EXPIRED", "Invite has expired");
  }

  const usedAt = now.toISOString();
  const sessionId = crypto.randomUUID();
  const sessionToken = randomToken();
  const sessionExpiresAt = new Date(
    now.getTime() + SESSION_LIFETIME
  ).toISOString();
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE pair_invites SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?"
      ).bind(usedAt, invite.id, usedAt),
      env.DB.prepare(
        "INSERT INTO device_sessions (id, member_id, invite_id, token_hash, device_name, last_seen_at, expires_at, revoked_at, created_at) SELECT ?, member_id, id, ?, ?, ?, ?, NULL, ? FROM pair_invites WHERE id = ? AND used_at = ? AND expires_at > ? AND member_id = ?"
      ).bind(
        sessionId,
        await hashToken(sessionToken),
        deviceName,
        usedAt,
        sessionExpiresAt,
        usedAt,
        invite.id,
        usedAt,
        usedAt,
        invite.member_id
      ),
    ]);
    if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) {
      throw new PairingError(
        410,
        "INVITE_ALREADY_USED",
        "Invite was already used"
      );
    }
  } catch (error) {
    if (error instanceof PairingError) throw error;
    const latest = await env.DB.prepare(
      "SELECT used_at FROM pair_invites WHERE id = ?"
    )
      .bind(invite.id)
      .first<{ used_at: string | null }>();
    if (latest?.used_at) {
      throw new PairingError(
        410,
        "INVITE_ALREADY_USED",
        "Invite was already used"
      );
    }
    throw error;
  }
  return { cookie: sessionCookie(sessionToken), redirectTo: "/library" };
}
