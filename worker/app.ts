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
import { OcrError, registerOcrRoutes } from "./routes/ocr";
import { registerPairingRoutes } from "./routes/pairing";
import { PlacesError, registerPlacesRoutes } from "./routes/places";
import { WeatherError, registerWeatherRoutes } from "./routes/weather";
import { registerParticipantRoutes } from "./routes/participants";
import { registerSessionRoutes } from "./routes/session";
import { registerSyncRoutes, SyncError } from "./routes/sync";
import { registerTripRoutes, TripError } from "./routes/trips";
import { MediaError, registerMediaRoutes } from "./routes/media";
import { MutationError } from "./services/mutations";
import { PairingError } from "./services/pairing";
import { ParticipantError } from "./services/participants";
import type { GooglePlacesFetch } from "./services/google-places";
import type { GoogleVisionFetch, VisionTokenProvider } from "./services/google-vision";
import type { WeatherProviderFetch } from "./services/open-meteo";

interface AppOverrides extends Partial<AppDependencies> {
  aiModelFetch?: AiModelFetch;
  placesFetch?: GooglePlacesFetch;
  visionFetch?: GoogleVisionFetch;
  visionTokenProvider?: VisionTokenProvider;
  weatherFetch?: WeatherProviderFetch;
}

export function createApp(overrides: AppOverrides = {}) {
  const app = new Hono<AppEnv>();
  const {
    aiModelFetch,
    placesFetch,
    visionFetch,
    visionTokenProvider,
    weatherFetch,
    ...accessOverrides
  } = overrides;
  const dependencies = { ...defaultDependencies, ...accessOverrides };

  app.use("/api/*", requireSameOrigin);
  app.get("/api/health", (c) => c.json({ ok: true }));
  registerAiModelRoutes(app, aiModelFetch);
  registerSessionRoutes(app, dependencies);
  registerParticipantRoutes(app, dependencies);
  registerPairingRoutes(app, dependencies);
  registerTripRoutes(app, dependencies);
  registerMediaRoutes(app, dependencies);
  registerOcrRoutes(app, dependencies, visionFetch, visionTokenProvider);
  registerPlacesRoutes(app, dependencies, placesFetch);
  registerWeatherRoutes(app, dependencies, weatherFetch);
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
    if (error instanceof PlacesError) {
      return apiError(c, error.status, error.code, error.message);
    }
    if (error instanceof WeatherError) {
      return apiError(c, error.status, error.code, error.message);
    }
    if (error instanceof OcrError) {
      return apiError(c, error.status, error.code, error.message);
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
