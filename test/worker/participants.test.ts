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
    await env.DB.prepare("DELETE FROM members WHERE id NOT IN ('owner', 'partner')").run();
    await env.DB.prepare(
      "UPDATE members SET display_name = CASE id WHEN 'owner' THEN '나' ELSE '여자친구' END, is_active = 1"
    ).run();
    await env.DB.prepare(
      "UPDATE app_settings SET representative_member_id = 'owner', setup_completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 'app'"
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
      body: JSON.stringify({ ownerName: "연준", participantNames: [] }),
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

  it("keeps seeded IDs while completing setup with multiple people", async () => {
    const response = await request("/api/admin/participants/setup", {
      method: "POST",
      body: JSON.stringify({
        ownerName: "연준",
        participantNames: ["민지", "수현"],
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
    expect(body.roster.representativeMemberId).toBe("owner");
    expect(body.roster.members).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "owner", displayName: "연준" }),
      expect.objectContaining({ id: "partner", displayName: "민지" }),
      expect.objectContaining({ displayName: "수현" }),
    ]));
  });

  it("adds a participant and changes only the travel representative", async () => {
    await request("/api/admin/participants/setup", {
      method: "POST",
      body: JSON.stringify({ ownerName: "연준", participantNames: ["민지"] }),
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
      roster: { representativeMemberId: member?.id },
    });

    const session = await request("/api/session");
    await expect(session.json()).resolves.toMatchObject({
      principal: { memberId: "owner", role: "owner" },
    });
  });
});
