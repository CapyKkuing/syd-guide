import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Env } from "../env";

type ParticipantRow = {
  id: string;
  display_name: string;
  is_active: number;
  device_count: number;
};

type SettingsRow = {
  representative_member_id: string;
  setup_completed_at: string | null;
};

export interface ParticipantSummary {
  id: string;
  displayName: string;
  isActive: boolean;
  isRepresentative: boolean;
  deviceCount: number;
}

export interface ParticipantRoster {
  setupComplete: boolean;
  representativeMemberId: string;
  members: ParticipantSummary[];
}

export class ParticipantError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function getParticipantRoster(env: Env): Promise<ParticipantRoster> {
  const [settings, members] = await Promise.all([
    env.DB.prepare(
      "SELECT representative_member_id, setup_completed_at FROM app_settings WHERE id = 'app'"
    ).first<SettingsRow>(),
    env.DB.prepare(
      `SELECT m.id, m.display_name, m.is_active,
              COUNT(CASE WHEN d.revoked_at IS NULL THEN d.id END) AS device_count
       FROM members m
       LEFT JOIN device_sessions d ON d.member_id = m.id
       GROUP BY m.id, m.display_name, m.is_active, m.created_at
       ORDER BY CASE WHEN m.id = 'owner' THEN 0 ELSE 1 END, m.created_at, m.id`
    ).all<ParticipantRow>(),
  ]);
  if (!settings) throw new Error("App settings could not be loaded");
  return {
    setupComplete: settings.setup_completed_at !== null,
    representativeMemberId: settings.representative_member_id,
    members: members.results.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      isActive: member.is_active === 1,
      isRepresentative: member.id === settings.representative_member_id,
      deviceCount: Number(member.device_count),
    })),
  };
}

export async function setupParticipants(
  env: Env,
  ownerName: string,
  participantNames: string[],
  now: Date
): Promise<ParticipantRoster> {
  const current = await getParticipantRoster(env);
  if (current.setupComplete) {
    throw new ParticipantError(409, "SETUP_ALREADY_COMPLETE", "참여자 설정이 이미 완료되었습니다.");
  }
  const timestamp = now.toISOString();
  const statements = [
    env.DB.prepare(
      "UPDATE members SET display_name = ?, is_active = 1 WHERE id = 'owner'"
    ).bind(ownerName),
    env.DB.prepare("UPDATE members SET is_active = 0 WHERE id <> 'owner'"),
    ...(participantNames[0] ? [
      env.DB.prepare(
        "UPDATE members SET display_name = ?, is_active = 1 WHERE id = 'partner'"
      ).bind(participantNames[0]),
    ] : []),
    ...participantNames.slice(1).map((name) =>
      env.DB.prepare(
        "INSERT INTO members (id, role, display_name, access_email, created_at, is_active) VALUES (?, 'partner', ?, NULL, ?, 1)"
      ).bind(crypto.randomUUID(), name, timestamp)
    ),
    env.DB.prepare(
      "UPDATE device_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE member_id IN (SELECT id FROM members WHERE is_active = 0)"
    ).bind(timestamp),
    env.DB.prepare(
      "UPDATE pair_invites SET expires_at = ? WHERE member_id IN (SELECT id FROM members WHERE is_active = 0) AND used_at IS NULL AND expires_at > ?"
    ).bind(timestamp, timestamp),
    env.DB.prepare(
      "DELETE FROM trip_members WHERE member_id IN (SELECT id FROM members WHERE is_active = 0)"
    ),
    env.DB.prepare(
      `INSERT OR IGNORE INTO trip_members (trip_id, member_id, joined_at)
       SELECT t.id, m.id, ? FROM trips t CROSS JOIN members m
       WHERE m.is_active = 1`
    ).bind(timestamp),
    env.DB.prepare(
      "UPDATE app_settings SET representative_member_id = 'owner', setup_completed_at = ?, updated_at = ? WHERE id = 'app' AND setup_completed_at IS NULL"
    ).bind(timestamp, timestamp),
  ];
  const results = await env.DB.batch(statements);
  if (results.at(-1)?.meta.changes !== 1) {
    throw new ParticipantError(409, "SETUP_ALREADY_COMPLETE", "참여자 설정이 이미 완료되었습니다.");
  }
  return getParticipantRoster(env);
}

export async function addParticipant(
  env: Env,
  displayName: string,
  now: Date
): Promise<ParticipantRoster> {
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO members (id, role, display_name, access_email, created_at, is_active) VALUES (?, 'partner', ?, NULL, ?, 1)"
    ).bind(id, displayName, timestamp),
    env.DB.prepare(
      `INSERT INTO trip_members (trip_id, member_id, joined_at)
       SELECT id, ?, ? FROM trips`
    ).bind(id, timestamp),
  ]);
  return getParticipantRoster(env);
}

export async function updateParticipant(
  env: Env,
  memberId: string,
  input: { displayName?: string; isRepresentative?: boolean },
  now: Date
): Promise<ParticipantRoster> {
  const member = await env.DB.prepare(
    "SELECT id, is_active FROM members WHERE id = ?"
  ).bind(memberId).first<{ id: string; is_active: number }>();
  if (!member || member.is_active !== 1) {
    throw new ParticipantError(404, "PARTICIPANT_NOT_FOUND", "참여자를 찾을 수 없습니다.");
  }
  const statements: D1PreparedStatement[] = [];
  if (input.displayName !== undefined) {
    statements.push(
      env.DB.prepare("UPDATE members SET display_name = ? WHERE id = ?")
        .bind(input.displayName, memberId)
    );
  }
  if (input.isRepresentative) {
    statements.push(
      env.DB.prepare(
        "UPDATE app_settings SET representative_member_id = ?, updated_at = ? WHERE id = 'app'"
      ).bind(memberId, now.toISOString())
    );
  }
  if (statements.length) await env.DB.batch(statements);
  return getParticipantRoster(env);
}

export async function removeParticipant(
  env: Env,
  memberId: string,
  now: Date
): Promise<ParticipantRoster> {
  if (memberId === "owner") {
    throw new ParticipantError(409, "OWNER_CANNOT_BE_REMOVED", "관리자는 삭제할 수 없습니다.");
  }
  const member = await env.DB.prepare(
    "SELECT id FROM members WHERE id = ? AND is_active = 1"
  ).bind(memberId).first<{ id: string }>();
  if (!member) {
    throw new ParticipantError(404, "PARTICIPANT_NOT_FOUND", "참여자를 찾을 수 없습니다.");
  }
  const timestamp = now.toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE members SET is_active = 0 WHERE id = ?")
      .bind(memberId),
    env.DB.prepare("DELETE FROM trip_members WHERE member_id = ?")
      .bind(memberId),
    env.DB.prepare(
      "UPDATE device_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE member_id = ?"
    ).bind(timestamp, memberId),
    env.DB.prepare(
      "UPDATE pair_invites SET expires_at = ? WHERE member_id = ? AND used_at IS NULL AND expires_at > ?"
    ).bind(timestamp, memberId, timestamp),
    env.DB.prepare(
      "UPDATE app_settings SET representative_member_id = 'owner', updated_at = ? WHERE id = 'app' AND representative_member_id = ?"
    ).bind(timestamp, memberId),
  ]);
  return getParticipantRoster(env);
}

export async function requireInvitableParticipant(env: Env, memberId: string) {
  const member = await env.DB.prepare(
    "SELECT id FROM members WHERE id = ? AND is_active = 1"
  ).bind(memberId).first<{ id: string }>();
  if (!member) {
    throw new ParticipantError(404, "PARTICIPANT_NOT_FOUND", "연결할 참여자를 찾을 수 없습니다.");
  }
}
