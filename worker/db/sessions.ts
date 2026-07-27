import type { Env } from "../env";

type DeviceRow = {
  id: string;
  device_name: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export interface DeviceSummary {
  id: string;
  deviceName: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export async function listDevices(env: Env): Promise<DeviceSummary[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, device_name, last_seen_at, expires_at, revoked_at, created_at FROM device_sessions WHERE member_id = 'partner' ORDER BY created_at DESC"
  ).all<DeviceRow>();
  return results.map((row) => ({
    id: row.id,
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
    "UPDATE device_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ? AND member_id = 'partner'"
  )
    .bind(now.toISOString(), deviceId)
    .run();
  return result.meta.changes > 0;
}
