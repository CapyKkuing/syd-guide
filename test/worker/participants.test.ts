import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../worker/app";
import type { Env } from "../../worker/env";

const now = new Date("2026-08-01T00:00:00.000Z");
const app = createApp({ now: () => now });

function bindings(): Env {
  return {
    ...env,
    SURFACE: "admin",
    APP_ORIGIN: "http://localhost",
    DEV_AUTH: "enabled",
  };
}

function request(path: string, init: RequestInit = {}) {
  return app.request(`http://localhost${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.method && init.method !== "GET" ? { Origin: "http://localhost" } : {}),
      "X-Dev-Principal": "owner",
      ...init.headers,
    },
  }, bindings());
}

describe("participant setup", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM device_sessions").run();
    await env.DB.prepare("DELETE FROM pair_invites").run();
    await env.DB.prepare("DELETE FROM trips").run();
    await env.DB.prepare(
      "UPDATE app_settings SET representative_member_id = 'owner', setup_completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 'app'"
    ).run();
    await env.DB.prepare("DELETE FROM members WHERE id NOT IN ('owner', 'partner')").run();
    await env.DB.prepare(
      "UPDATE members SET display_name = CASE id WHEN 'owner' THEN '나' ELSE '여자친구' END, is_active = 1"
    ).run();
  });

  it("completes setup with only the owner", async () => {
    const tripResponse = await request("/api/trips", {
      method: "POST",
      body: JSON.stringify({
        title: "시드니 여행",
        destination: "Sydney",
        startDate: "2026-10-08",
        endDate: "2026-10-15",
        timeZone: "Australia/Sydney",
        status: "upcoming",
        coverImageUrl: null,
      }),
    });
    const trip = await tripResponse.json() as { trip: { id: string } };

    const response = await request("/api/admin/participants/setup", {
      method: "POST",
      body: JSON.stringify({ ownerName: "연준", participantNames: [], representativeIndex: 0 }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as {
      roster: {
        setupComplete: boolean;
        representativeMemberId: string;
        members: Array<{ id: string; displayName: string; isActive: boolean }>;
      };
    };
    expect(body.roster).toMatchObject({
      setupComplete: true,
      representativeMemberId: "owner",
    });
    expect(body.roster.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "owner", displayName: "연준", isActive: true }),
      expect.objectContaining({ id: "partner", isActive: false }),
    ]));
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM trip_members WHERE trip_id = ?"
    ).bind(trip.trip.id).first<{ count: number }>()).resolves.toMatchObject({ count: 1 });
  });

  it("revokes devices and unused invites for members deactivated during setup", async () => {
    await env.DB.prepare(
      "INSERT INTO pair_invites (id, token_hash, created_by, expires_at, used_at, created_at, member_id) VALUES ('invite-used', 'used-hash', 'owner', '2026-08-01T00:10:00.000Z', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', 'partner'), ('invite-unused', 'unused-hash', 'owner', '2026-08-01T00:10:00.000Z', NULL, '2026-08-01T00:00:00.000Z', 'partner')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO device_sessions (id, member_id, invite_id, token_hash, device_name, last_seen_at, expires_at, revoked_at, created_at) VALUES ('device-partner', 'partner', 'invite-used', 'session-hash', '이전 iPhone', '2026-08-01T00:00:00.000Z', '2026-10-30T00:00:00.000Z', NULL, '2026-08-01T00:00:00.000Z')"
    ).run();

    const response = await request("/api/admin/participants/setup", {
      method: "POST",
      body: JSON.stringify({ ownerName: "연준", participantNames: [], representativeIndex: 0 }),
    });

    expect(response.status).toBe(200);
    await expect(env.DB.prepare(
      "SELECT revoked_at FROM device_sessions WHERE id = 'device-partner'"
    ).first<{ revoked_at: string }>()).resolves.toEqual({ revoked_at: now.toISOString() });
    await expect(env.DB.prepare(
      "SELECT expires_at FROM pair_invites WHERE id = 'invite-unused'"
    ).first<{ expires_at: string }>()).resolves.toEqual({ expires_at: now.toISOString() });
  });

  it("keeps seeded IDs while completing setup with multiple people", async () => {
    const response = await request("/api/admin/participants/setup", {
      method: "POST",
      body: JSON.stringify({
        ownerName: "연준",
        participantNames: ["민지", "수현"],
        representativeIndex: 2,
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as {
      roster: {
        setupComplete: boolean;
        representativeMemberId: string;
        members: Array<{ id: string; displayName: string }>;
      };
    };
    expect(body.roster.setupComplete).toBe(true);
    const representative = body.roster.members.find((member) => member.displayName === "수현");
    expect(representative).toBeDefined();
    expect(body.roster.representativeMemberId).toBe(representative?.id);
    expect(body.roster.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "owner", displayName: "연준" }),
      expect.objectContaining({ id: "partner", displayName: "민지" }),
      expect.objectContaining({ displayName: "수현" }),
    ]));
  });

  it("adds a participant and changes only the travel representative", async () => {
    await request("/api/admin/participants/setup", {
      method: "POST",
      body: JSON.stringify({
        ownerName: "연준",
        participantNames: ["민지"],
        representativeIndex: 0,
      }),
    });
    const tripResponse = await request("/api/trips", {
      method: "POST",
      body: JSON.stringify({
        title: "시드니 여행",
        destination: "Sydney",
        startDate: "2026-10-08",
        endDate: "2026-10-15",
        timeZone: "Australia/Sydney",
        status: "upcoming",
        coverImageUrl: null,
      }),
    });
    const trip = await tripResponse.json() as { trip: { id: string } };
    const added = await request("/api/admin/participants", {
      method: "POST",
      body: JSON.stringify({ displayName: "수현" }),
    });
    const addedBody = await added.json() as {
      roster: { members: Array<{ id: string; displayName: string }> };
    };
    const member = addedBody.roster.members.find((item) => item.displayName === "수현");
    expect(member).toBeDefined();
    await expect(env.DB.prepare(
      "SELECT member_id FROM trip_members WHERE trip_id = ? AND member_id = ?"
    ).bind(trip.trip.id, member?.id).first()).resolves.toBeTruthy();

    const changed = await request(`/api/admin/participants/${member?.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isRepresentative: true }),
    });
    await expect(changed.json()).resolves.toMatchObject({
      roster: {
        representativeMemberId: member?.id,
        members: expect.arrayContaining([
          expect.objectContaining({ id: "owner", isRepresentative: false }),
          expect.objectContaining({ id: member?.id, isRepresentative: true }),
        ]),
      },
    });

    const session = await request("/api/session");
    await expect(session.json()).resolves.toMatchObject({
      principal: { memberId: "owner", role: "owner" },
    });
  });

  it("removes a participant while preserving history and revoking access", async () => {
    await request("/api/admin/participants/setup", {
      method: "POST",
      body: JSON.stringify({
        ownerName: "연준",
        participantNames: ["민지"],
        representativeIndex: 0,
      }),
    });
    const tripResponse = await request("/api/trips", {
      method: "POST",
      body: JSON.stringify({
        title: "시드니 여행",
        destination: "Sydney",
        startDate: "2026-10-08",
        endDate: "2026-10-15",
        timeZone: "Australia/Sydney",
        status: "upcoming",
        coverImageUrl: null,
      }),
    });
    const trip = await tripResponse.json() as { trip: { id: string } };
    await request("/api/admin/participants/partner", {
      method: "PATCH",
      body: JSON.stringify({ isRepresentative: true }),
    });
    await env.DB.prepare(
      "INSERT INTO pair_invites (id, token_hash, created_by, expires_at, used_at, created_at, member_id) VALUES ('invite-partner', 'invite-hash', 'owner', '2026-08-01T00:10:00.000Z', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', 'partner'), ('invite-unused', 'unused-hash', 'owner', '2026-08-01T00:10:00.000Z', NULL, '2026-08-01T00:00:00.000Z', 'partner')"
    ).run();
    await env.DB.prepare(
      "INSERT INTO device_sessions (id, member_id, invite_id, token_hash, device_name, last_seen_at, expires_at, revoked_at, created_at) VALUES ('device-partner', 'partner', 'invite-partner', 'session-hash', '민지 iPhone', '2026-08-01T00:00:00.000Z', '2026-10-30T00:00:00.000Z', NULL, '2026-08-01T00:00:00.000Z')"
    ).run();

    const response = await request("/api/admin/participants/partner", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      roster: {
        representativeMemberId: "owner",
        members: expect.arrayContaining([
          expect.objectContaining({ id: "partner", isActive: false }),
        ]),
      },
    });
    await expect(env.DB.prepare(
      "SELECT COUNT(*) AS count FROM trip_members WHERE trip_id = ? AND member_id = 'partner'"
    ).bind(trip.trip.id).first<{ count: number }>()).resolves.toEqual({ count: 0 });
    await expect(env.DB.prepare(
      "SELECT revoked_at FROM device_sessions WHERE id = 'device-partner'"
    ).first<{ revoked_at: string }>()).resolves.toEqual({ revoked_at: now.toISOString() });
    await expect(env.DB.prepare(
      "SELECT expires_at FROM pair_invites WHERE id = 'invite-unused'"
    ).first<{ expires_at: string }>()).resolves.toEqual({ expires_at: now.toISOString() });
  });

  it("does not allow the owner to be removed", async () => {
    const response = await request("/api/admin/participants/owner", {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "OWNER_CANNOT_BE_REMOVED" },
    });
  });
});
