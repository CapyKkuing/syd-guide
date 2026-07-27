import type { Hono } from "hono";
import type { AppDependencies } from "../auth/access";
import { requireOwner } from "../auth/principal";
import { listDevices, revokeDevice } from "../db/sessions";
import type { AppEnv } from "../env";
import { claimInvite, issueInvite, PairingError } from "../services/pairing";

export function registerPairingRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies
) {
  app.post("/api/admin/invites", async (c) => {
    await requireOwner(c, dependencies);
    return c.json({ invite: await issueInvite(c.env, dependencies.now()) }, 201);
  });

  app.get("/api/admin/devices", async (c) => {
    await requireOwner(c, dependencies);
    return c.json({ devices: await listDevices(c.env) });
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
