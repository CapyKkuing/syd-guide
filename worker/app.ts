import { Hono } from "hono";
import {
  defaultDependencies,
  type AppDependencies,
} from "./auth/access";
import { requireSameOrigin } from "./auth/origin";
import { AuthError } from "./auth/principal";
import type { AppEnv } from "./env";
import { apiError } from "./http/errors";
import { registerAiModelRoutes, type AiModelFetch } from "./routes/ai-model";
import { registerPairingRoutes } from "./routes/pairing";
import { registerParticipantRoutes } from "./routes/participants";
import { registerSessionRoutes } from "./routes/session";
import { registerSyncRoutes, SyncError } from "./routes/sync";
import { registerTripRoutes, TripError } from "./routes/trips";
import { MediaError, registerMediaRoutes } from "./routes/media";
import { MutationError } from "./services/mutations";
import { PairingError } from "./services/pairing";
import { ParticipantError } from "./services/participants";

interface AppOverrides extends Partial<AppDependencies> {
  aiModelFetch?: AiModelFetch;
}

export function createApp(overrides: AppOverrides = {}) {
  const app = new Hono<AppEnv>();
  const { aiModelFetch, ...accessOverrides } = overrides;
  const dependencies = { ...defaultDependencies, ...accessOverrides };

  app.use("/api/*", requireSameOrigin);
  app.get("/api/health", (c) => c.json({ ok: true }));
  registerAiModelRoutes(app, aiModelFetch);
  registerSessionRoutes(app, dependencies);
  registerParticipantRoutes(app, dependencies);
  registerPairingRoutes(app, dependencies);
  registerTripRoutes(app, dependencies);
  registerMediaRoutes(app, dependencies);
  registerSyncRoutes(app, dependencies);
  app.all("/api/*", (c) =>
    apiError(c, 404, "NOT_FOUND", "API route not found")
  );
  app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
  app.onError((error, c) => {
    if (error instanceof AuthError) {
      return apiError(c, error.status, error.code, error.message);
    }
    if (error instanceof PairingError) {
      return apiError(c, error.status, error.code, error.message);
    }
    if (error instanceof ParticipantError) {
      return apiError(c, error.status, error.code, error.message);
    }
    if (error instanceof TripError) {
      return apiError(
        c,
        error.status,
        error.code,
        error.message,
        error.details
      );
    }
    if (error instanceof MediaError) {
      return apiError(
        c,
        error.status,
        error.code,
        error.message,
        error.details
      );
    }
    if (error instanceof MutationError || error instanceof SyncError) {
      return apiError(
        c,
        error.status,
        error.code,
        error.message,
        error.details
      );
    }
    throw error;
  });

  return app;
}
