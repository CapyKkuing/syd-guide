export interface Invite {
  url: string;
  token: string;
  expiresAt: string;
}

export interface Device {
  id: string;
  memberId: string;
  memberName: string;
  deviceName: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface Participant {
  id: string;
  displayName: string;
  isActive: boolean;
  isRepresentative: boolean;
  deviceCount: number;
}

export interface ParticipantRoster {
  setupComplete: boolean;
  representativeMemberId: string;
  members: Participant[];
}

export interface SessionPrincipal {
  memberId: string;
  role: "owner" | "partner";
  sessionId?: string;
}

function isLocalHost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

function headers(admin: boolean, json = false) {
  const result = new Headers();
  if (json) result.set("Content-Type", "application/json");
  if (admin && isLocalHost()) {
    result.set("X-Dev-Principal", "owner");
  }
  return result;
}

async function ensureOk(response: Response) {
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  throw new Error(body?.error?.message ?? "요청을 처리하지 못했습니다.");
}

async function json<T>(response: Response): Promise<T> {
  await ensureOk(response);
  return response.json() as Promise<T>;
}

export async function createInvite(memberId: string): Promise<Invite> {
  const response = await fetch("/api/admin/invites", {
    method: "POST",
    headers: headers(true, true),
    body: JSON.stringify({ memberId }),
  });
  return (await json<{ invite: Invite }>(response)).invite;
}

export async function getParticipantRoster(): Promise<ParticipantRoster> {
  const response = await fetch("/api/admin/participants", {
    headers: headers(true),
  });
  return (await json<{ roster: ParticipantRoster }>(response)).roster;
}

export async function setupParticipants(
  ownerName: string,
  participantNames: string[]
): Promise<ParticipantRoster> {
  const response = await fetch("/api/admin/participants/setup", {
    method: "POST",
    headers: headers(true, true),
    body: JSON.stringify({ ownerName, participantNames }),
  });
  return (await json<{ roster: ParticipantRoster }>(response)).roster;
}

export async function addParticipant(displayName: string): Promise<ParticipantRoster> {
  const response = await fetch("/api/admin/participants", {
    method: "POST",
    headers: headers(true, true),
    body: JSON.stringify({ displayName }),
  });
  return (await json<{ roster: ParticipantRoster }>(response)).roster;
}

export async function updateParticipant(
  memberId: string,
  input: { displayName?: string; isRepresentative?: true }
): Promise<ParticipantRoster> {
  const response = await fetch(
    `/api/admin/participants/${encodeURIComponent(memberId)}`,
    {
      method: "PATCH",
      headers: headers(true, true),
      body: JSON.stringify(input),
    }
  );
  return (await json<{ roster: ParticipantRoster }>(response)).roster;
}

export async function getPrincipal(): Promise<SessionPrincipal> {
  const localPartner =
    isLocalHost() && localStorage.getItem("couple_dev_principal") === "partner";
  const response = await fetch("/api/session", {
    headers: headers(!localPartner),
  });
  return (await json<{ principal: SessionPrincipal }>(response)).principal;
}

export async function getDevices(): Promise<Device[]> {
  const response = await fetch("/api/admin/devices", {
    headers: headers(true),
  });
  return (await json<{ devices: Device[] }>(response)).devices;
}

export async function removeDevice(deviceId: string): Promise<void> {
  const response = await fetch(
    `/api/admin/devices/${encodeURIComponent(deviceId)}`,
    { method: "DELETE", headers: headers(true) }
  );
  await ensureOk(response);
}

export async function deleteRevokedDevice(deviceId: string): Promise<void> {
  const response = await fetch(
    `/api/admin/devices/${encodeURIComponent(deviceId)}/permanent`,
    { method: "DELETE", headers: headers(true) }
  );
  await ensureOk(response);
}

export async function claimDevice(token: string, deviceName: string) {
  const response = await fetch("/api/pair/claim", {
    method: "POST",
    headers: headers(false, true),
    body: JSON.stringify({ token, deviceName }),
  });
  const result = await json<{ redirectTo: "/library" }>(response);
  if (isLocalHost()) localStorage.setItem("couple_dev_principal", "partner");
  return result;
}
