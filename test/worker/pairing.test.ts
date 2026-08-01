import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import type { Env } from "../../worker/env";

type Invite = { url: string; token: string; expiresAt: string };

let currentTime = new Date("2026-07-27T00:00:00.000Z");
const app = createApp({ now: () => currentTime });

function bindings(surface: Env["SURFACE"]): Env {
  return {
    ...env,
    SURFACE: surface,
    APP_ORIGIN: "https://partner.example",
    PARTNER_ORIGIN: "https://partner.example",
    DEV_AUTH: "enabled",
  };
}

async function issueInvite(): Promise<Invite> {
  const response = await app.request(
    "http://localhost/api/admin/invites",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        "X-Dev-Principal": "owner",
      },
      body: JSON.stringify({ memberId: "partner" }),
    },
    bindings("admin")
  );
  expect(response.status).toBe(201);
  const body = (await response.json()) as { invite: Invite };
  return body.invite;
}

async function claimInvite(token: string, deviceName: string) {
  return app.request(
    "https://partner.example/api/pair/claim",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://partner.example",
      },
      body: JSON.stringify({ token, deviceName }),
    },
    bindings("partner")
  );
}

describe("one-time device pairing", () => {
  beforeEach(async () => {
    currentTime = new Date("2026-07-27T00:00:00.000Z");
    await env.DB.prepare("DELETE FROM device_sessions").run();
    await env.DB.prepare("DELETE FROM pair_invites").run();
  });

  it("accepts a fresh invite once and rejects replay", async () => {
    const invite = await issueInvite();
    const first = await claimInvite(invite.token, "iPhone");
    const replay = await claimInvite(invite.token, "second phone");

    expect(first.status).toBe(200);
    expect(first.headers.get("set-cookie")).toContain("HttpOnly");
    await expect(first.json()).resolves.toEqual({ redirectTo: "/library" });
    expect(replay.status).toBe(410);
    await expect(replay.json()).resolves.toMatchObject({
      error: { code: "INVITE_ALREADY_USED" },
    });

    const stored = await env.DB.prepare(
      "SELECT token_hash FROM pair_invites"
    ).first<{ token_hash: string }>();
    expect(stored?.token_hash).not.toBe(invite.token);
  });

  it("rejects an invite after ten minutes", async () => {
    const invite = await issueInvite();
    currentTime = new Date("2026-07-27T00:10:00.001Z");

    const response = await claimInvite(invite.token, "iPhone");
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVITE_EXPIRED" },
    });
  });

  it("fails closed when an invite expiry is invalid", async () => {
    const invite = await issueInvite();
    await env.DB.prepare("UPDATE pair_invites SET expires_at = 'invalid'").run();

    const response = await claimInvite(invite.token, "iPhone");
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVITE_EXPIRED" },
    });
  });

  it("lists devices without secrets and lets the owner revoke one", async () => {
    const invite = await issueInvite();
    await claimInvite(invite.token, "Galaxy");

    const list = await app.request(
      "http://localhost/api/admin/devices",
      { headers: { "X-Dev-Principal": "owner" } },
      bindings("admin")
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as {
      devices: Array<{
        id: string;
        memberId: string;
        memberName: string;
        deviceName: string;
        revokedAt: string | null;
      }>;
    };
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0]).toMatchObject({
      deviceName: "Galaxy",
      memberId: "partner",
      revokedAt: null,
    });
    expect(body.devices[0]).not.toHaveProperty("tokenHash");

    const revoke = await app.request(
      `http://localhost/api/admin/devices/${body.devices[0]?.id}`,
      {
        method: "DELETE",
        headers: {
          Origin: "http://localhost",
          "X-Dev-Principal": "owner",
        },
      },
      bindings("admin")
    );
    expect(revoke.status).toBe(204);

    const revokedAt = await env.DB.prepare(
      "SELECT revoked_at FROM device_sessions"
    ).first<{ revoked_at: string }>();
    expect(revokedAt?.revoked_at).toBe(currentTime.toISOString());

    const permanentDelete = await app.request(
      `http://localhost/api/admin/devices/${body.devices[0]?.id}/permanent`,
      {
        method: "DELETE",
        headers: {
          Origin: "http://localhost",
          "X-Dev-Principal": "owner",
        },
      },
      bindings("admin")
    );
    expect(permanentDelete.status).toBe(204);
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM device_sessions"
    ).first<{ count: number }>()).resolves.toEqual({ count: 0 });
  });

  it("refuses to permanently delete a device before it is revoked", async () => {
    const invite = await issueInvite();
    await claimInvite(invite.token, "Active Galaxy");
    const device = await env.DB.prepare(
      "SELECT id FROM device_sessions"
    ).first<{ id: string }>();

    const response = await app.request(
      `http://localhost/api/admin/devices/${device?.id}/permanent`,
      {
        method: "DELETE",
        headers: {
          Origin: "http://localhost",
          "X-Dev-Principal": "owner",
        },
      },
      bindings("admin")
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DEVICE_STILL_ACTIVE" },
    });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM device_sessions"
    ).first<{ count: number }>()).resolves.toEqual({ count: 1 });
  });

  it("does not allow a partner to use owner device APIs", async () => {
    const response = await app.request(
      "http://localhost/api/admin/devices",
      { headers: { "X-Dev-Principal": "partner" } },
      bindings("partner")
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "OWNER_REQUIRED" },
    });
  });
});
