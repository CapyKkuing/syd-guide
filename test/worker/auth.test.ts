import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import type { AccessTokenVerifier } from "../../worker/auth/access";
import { hashToken } from "../../worker/auth/hash";
import type { Env } from "../../worker/env";

const now = new Date("2026-07-27T00:00:00.000Z");
const clock = () => now;

function bindings(surface: Env["SURFACE"], overrides: Partial<Env> = {}): Env {
  return {
    ...env,
    SURFACE: surface,
    APP_ORIGIN: "http://localhost:5173",
    DEV_AUTH: "enabled",
    ...overrides,
  };
}

async function addSession(
  id: string,
  token: string,
  options: { expiresAt?: string; revokedAt?: string | null; lastSeenAt?: string } = {}
) {
  const inviteId = `invite-${id}`;
  await env.DB.prepare(
    "INSERT INTO pair_invites (id, token_hash, created_by, expires_at, used_at, created_at) VALUES (?, ?, 'owner', ?, ?, ?)"
  )
    .bind(inviteId, `invite-hash-${id}`, now.toISOString(), now.toISOString(), now.toISOString())
    .run();
  await env.DB.prepare(
    "INSERT INTO device_sessions (id, member_id, invite_id, token_hash, device_name, last_seen_at, expires_at, revoked_at, created_at) VALUES (?, 'partner', ?, ?, 'Test phone', ?, ?, ?, ?)"
  )
    .bind(
      id,
      inviteId,
      await hashToken(token),
      options.lastSeenAt ?? now.toISOString(),
      options.expiresAt ?? "2026-10-25T00:00:00.000Z",
      options.revokedAt ?? null,
      now.toISOString()
    )
    .run();
}

describe("authentication boundary", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM device_sessions").run();
    await env.DB.prepare("DELETE FROM pair_invites").run();
    await env.DB.prepare("UPDATE members SET access_email = NULL WHERE id = 'owner'").run();
  });

  it("rejects partner API without a device cookie", async () => {
    const response = await createApp({ now: clock }).request(
      "http://localhost/api/session",
      {},
      bindings("partner")
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SESSION_REQUIRED" },
    });
  });

  it("rejects unsafe writes from another origin", async () => {
    const response = await createApp({ now: clock }).request(
      "http://localhost/api/session/logout",
      { method: "POST", headers: { Origin: "https://evil.example" } },
      bindings("partner")
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_REJECTED" },
    });
  });

  it("allows dev principals only on a local hostname", async () => {
    const app = createApp({ now: clock });
    const local = await app.request(
      "http://localhost/api/session",
      { headers: { "X-Dev-Principal": "owner" } },
      bindings("admin")
    );
    expect(local.status).toBe(200);

    const remote = await app.request(
      "https://travel.example/api/session",
      { headers: { "X-Dev-Principal": "owner" } },
      bindings("admin")
    );
    expect(remote.status).toBe(401);
  });

  it("verifies the Access email before granting owner access", async () => {
    const accessVerifier: AccessTokenVerifier = {
      verify: async () => ({ email: "OWNER@example.com", sub: "access-user" }),
    };
    const response = await createApp({ accessVerifier, now: clock }).request(
      "https://admin.example/api/session",
      { headers: { "Cf-Access-Jwt-Assertion": "signed-token" } },
      bindings("admin", {
        ADMIN_EMAIL: "owner@example.com",
        ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        ACCESS_AUD: "audience",
        DEV_AUTH: undefined,
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      principal: { memberId: "owner", role: "owner" },
    });
    await expect(
      env.DB.prepare("SELECT access_email FROM members WHERE id = 'owner'")
        .first<{ access_email: string }>()
    ).resolves.toEqual({ access_email: "owner@example.com" });
  });

  it("returns to the requested app screen after Access login", async () => {
    const accessVerifier: AccessTokenVerifier = {
      verify: async () => ({ email: "owner@example.com", sub: "access-user" }),
    };
    const response = await createApp({ accessVerifier, now: clock }).request(
      "https://admin.example/api/session?continue=%2Ftrip%2Fsydney-2026%2Fmanagement",
      { headers: { "Cf-Access-Jwt-Assertion": "signed-token" } },
      bindings("admin", {
        ADMIN_EMAIL: "owner@example.com",
        ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        ACCESS_AUD: "audience",
        DEV_AUTH: undefined,
      })
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location"))
      .toBe("/trip/sydney-2026/management");
  });

  it("does not redirect Access login to an external origin", async () => {
    const accessVerifier: AccessTokenVerifier = {
      verify: async () => ({ email: "owner@example.com", sub: "access-user" }),
    };
    const response = await createApp({ accessVerifier, now: clock }).request(
      "https://admin.example/api/session?continue=https%3A%2F%2Fevil.example%2Fsteal",
      { headers: { "Cf-Access-Jwt-Assertion": "signed-token" } },
      bindings("admin", {
        ADMIN_EMAIL: "owner@example.com",
        ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
        ACCESS_AUD: "audience",
        DEV_AUTH: undefined,
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      principal: { memberId: "owner", role: "owner" },
    });
  });

  it("denies an Access identity that is not the configured owner", async () => {
    const accessVerifier: AccessTokenVerifier = {
      verify: async () => ({ email: "other@example.com", sub: "other-user" }),
    };
    const response = await createApp({ accessVerifier, now: clock }).request(
      "https://admin.example/api/session",
      { headers: { "Cf-Access-Jwt-Assertion": "signed-token" } },
      bindings("admin", {
        ADMIN_EMAIL: "owner@example.com",
        DEV_AUTH: undefined,
      })
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ACCESS_DENIED" },
    });
  });

  it("loads a valid partner session and refreshes an old last-seen time", async () => {
    await addSession("session-valid", "device-token", {
      lastSeenAt: "2026-07-25T00:00:00.000Z",
    });
    const response = await createApp({ now: clock }).request(
      "https://travel.example/api/session",
      { headers: { Cookie: "couple_session=device-token" } },
      bindings("partner", { DEV_AUTH: undefined })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      principal: {
        memberId: "partner",
        role: "partner",
        sessionId: "session-valid",
      },
    });
    const session = await env.DB.prepare(
      "SELECT last_seen_at, expires_at FROM device_sessions WHERE id = ?"
    )
      .bind("session-valid")
      .first<{ last_seen_at: string; expires_at: string }>();
    expect(session).toEqual({
      last_seen_at: now.toISOString(),
      expires_at: "2026-10-25T00:00:00.000Z",
    });
  });

  it.each([
    ["SESSION_EXPIRED", { expiresAt: "2026-07-26T23:59:59.000Z" }],
    ["SESSION_EXPIRED", { expiresAt: "invalid-date" }],
    ["SESSION_REVOKED", { revokedAt: "2026-07-26T00:00:00.000Z" }],
  ])("returns %s for an unusable partner session", async (code, options) => {
    await addSession(`session-${code}`, `token-${code}`, options);
    const response = await createApp({ now: clock }).request(
      "https://travel.example/api/session",
      { headers: { Cookie: `couple_session=token-${code}` } },
      bindings("partner", { DEV_AUTH: undefined })
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it("revokes the current partner session and clears its cookie", async () => {
    await addSession("session-logout", "logout-token");
    const response = await createApp({ now: clock }).request(
      "https://travel.example/api/session/logout",
      {
        method: "POST",
        headers: {
          Cookie: "couple_session=logout-token",
          Origin: "https://travel.example",
        },
      },
      bindings("partner", { DEV_AUTH: undefined })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(
      env.DB.prepare("SELECT revoked_at FROM device_sessions WHERE id = ?")
        .bind("session-logout")
        .first<{ revoked_at: string }>()
    ).resolves.toEqual({ revoked_at: now.toISOString() });
  });
});
