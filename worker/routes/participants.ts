import type { Hono } from "hono";
import { z } from "zod";
import type { AppDependencies } from "../auth/access";
import { requireOwner } from "../auth/principal";
import type { AppEnv } from "../env";
import {
  addParticipant,
  getParticipantRoster,
  ParticipantError,
  setupParticipants,
  updateParticipant,
} from "../services/participants";

const name = z.string().trim().min(1).max(40);
const setupSchema = z.object({
  ownerName: name,
  participantNames: z.array(name).max(20),
});
const addSchema = z.object({ displayName: name });
const updateSchema = z.object({
  displayName: name.optional(),
  isRepresentative: z.literal(true).optional(),
}).refine((value) => value.displayName !== undefined || value.isRepresentative, {
  message: "변경할 값이 필요합니다.",
});

async function input<T extends z.ZodType>(request: Request, schema: T) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new ParticipantError(400, "PARTICIPANT_INPUT_INVALID", "참여자 입력값이 올바르지 않습니다.");
  }
  return parsed.data as z.output<T>;
}

function memberId(value: string) {
  if (!value || value.length > 100) {
    throw new ParticipantError(400, "PARTICIPANT_ID_INVALID", "참여자 ID가 올바르지 않습니다.");
  }
  return value;
}

export function registerParticipantRoutes(
  app: Hono<AppEnv>,
  dependencies: AppDependencies
) {
  app.get("/api/admin/participants", async (c) => {
    await requireOwner(c, dependencies);
    return c.json({ roster: await getParticipantRoster(c.env) });
  });

  app.post("/api/admin/participants/setup", async (c) => {
    await requireOwner(c, dependencies);
    const values = await input(c.req.raw, setupSchema);
    return c.json({
      roster: await setupParticipants(
        c.env,
        values.ownerName,
        values.participantNames,
        dependencies.now()
      ),
    });
  });

  app.post("/api/admin/participants", async (c) => {
    await requireOwner(c, dependencies);
    const values = await input(c.req.raw, addSchema);
    return c.json({
      roster: await addParticipant(c.env, values.displayName, dependencies.now()),
    }, 201);
  });

  app.patch("/api/admin/participants/:id", async (c) => {
    await requireOwner(c, dependencies);
    const values = await input(c.req.raw, updateSchema);
    return c.json({
      roster: await updateParticipant(
        c.env,
        memberId(c.req.param("id")),
        values,
        dependencies.now()
      ),
    });
  });
}
