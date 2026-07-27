export interface Invite {
  url: string;
  token: string;
  expiresAt: string;
}

export interface Device {
  id: string;
  deviceName: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
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

export async function createInvite(): Promise<Invite> {
  const response = await fetch("/api/admin/invites", {
    method: "POST",
    headers: headers(true),
  });
  return (await json<{ invite: Invite }>(response)).invite;
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
