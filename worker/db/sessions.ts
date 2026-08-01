import type { Env } from "../env";

type DeviceRow = {
  id: string;
  member_id: string;
  display_name: string;
  device_name: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export interface DeviceSummary {
  id: string;
  memberId: string;
  memberName: string;
  deviceName: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export async function listDevices(env: Env): Promise<DeviceSummary[]> {
  const { results } = await env.DB.prepare(
    `SELECT d.id, d.member_id, m.display_name, d.device_name, d.last_seen_at,
            d.expires_at, d.revoked_at, d.created_at
     FROM device_sessions d
     INNER JOIN members m ON m.id = d.member_id
     ORDER BY d.created_at DESC`
  ).all<DeviceRow>();
  return results.map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberName: row.display_name,
    deviceName: row.device_name,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

export async function revokeDevice(
  env: Env,
  deviceId: string,
  now: Date
): Promise<boolean> {
  const result = await env.DB.prepare(
    "UPDATE device_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?"
  )
    .bind(now.toISOString(), deviceId)
    .run();
  return result.meta.changes > 0;
}

export async function deleteRevokedDevice(
  env: Env,
  deviceId: string
): Promise<"deleted" | "active" | "missing"> {
  const result = await env.DB.prepare(
    "DELETE FROM device_sessions WHERE id = ? AND revoked_at IS NOT NULL"
  )
    .bind(deviceId)
    .run();
  if (result.meta.changes > 0) return "deleted";

  const device = await env.DB.prepare(
    "SELECT id FROM device_sessions WHERE id = ?"
  ).bind(deviceId).first<{ id: string }>();
  return device ? "active" : "missing";
}
