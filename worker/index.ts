import { createApp } from "./app";
import type { Env } from "./env";
import { purgeExpiredTrips } from "./services/purge";

const app = createApp();

export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
  },
  scheduled(event, env, context) {
    context.waitUntil(
      purgeExpiredTrips(env.DB, new Date(event.scheduledTime).toISOString())
    );
  }
} satisfies ExportedHandler<Env>;
