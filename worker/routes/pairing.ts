import type { Hono } from "hono";
import type { AppDependencies } from "../auth/access";
import { requireOwner } from "../auth/principal";
import {
  deleteRevokedDevice,
  listDevices,
  revokeDevice,
} from "../db/sessions";
import type { AppEnv } from "../env";
import { claimInvite, issueInvite, PairingError } from "../services/pairing";
import { requireInvitableParticipant } from "../services/participants";

export function registerPairingRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies
) {
  app.post("/api/admin/invites", async (c) => {
    await requireOwner(c, dependencies);
    const body = await c.req.json<unknown>().catch(() => null);
    const memberId = body && typeof body === "object" && "memberId" in body
      && typeof body.memberId === "string" ? body.memberId : "";
    if (!memberId || memberId.length > 100) {
      throw new PairingError(400, "PARTICIPANT_ID_INVALID", "연결할 참여자를 선택해 주세요.");
    }
    await requireInvitableParticipant(c.env, memberId);
    return c.json({
      invite: await issueInvite(c.env, memberId, dependencies.now()),
    }, 201);
  });

  app.get("/api/admin/devices", async (c) => {
    await requireOwner(c, dependencies);
    return c.json({ devices: await listDevices(c.env) });
  });

  app.delete("/api/admin/devices/:id/permanent", async (c) => {
    await requireOwner(c, dependencies);
    const id = c.req.param("id");
    if (!id || id.length > 100) {
      throw new PairingError(400, "DEVICE_INVALID", "기기 정보가 올바르지 않습니다.");
    }
    const result = await deleteRevokedDevice(c.env, id);
    if (result === "active") {
      throw new PairingError(409, "DEVICE_STILL_ACTIVE", "먼저 기기 연결을 해제해 주세요.");
    }
    if (result === "missing") {
      throw new PairingError(404, "DEVICE_NOT_FOUND", "기기를 찾을 수 없습니다.");
    }
    return c.body(null, 204);
  });

  app.delete("/api/admin/devices/:id", async (c) => {
    await requireOwner(c, dependencies);
    const id = c.req.param("id");
    if (!id || id.length > 100) {
      throw new PairingError(400, "DEVICE_INVALID", "Device is not valid");
    }
    const revoked = await revokeDevice(c.env, id, dependencies.now());
    if (!revoked) {
      throw new PairingError(404, "DEVICE_NOT_FOUND", "Device was not found");
    }
    return c.body(null, 204);
  });

  app.post("/api/pair/claim", async (c) => {
    const body = await c.req.json<unknown>().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new PairingError(400, "PAIR_INPUT_INVALID", "Pairing input is invalid");
    }
    const input = body as Record<string, unknown>;
    const token = typeof input.token === "string" ? input.token : "";
    const deviceName =
      typeof input.deviceName === "string" ? input.deviceName.trim() : "";
    if (!deviceName || deviceName.length > 80) {
      throw new PairingError(400, "DEVICE_NAME_INVALID", "Device name is invalid");
    }
    const result = await claimInvite(c.env, token, deviceName, dependencies.now());
    return c.json(
      { redirectTo: result.redirectTo },
      200,
      { "Set-Cookie": result.cookie }
    );
  });
}
