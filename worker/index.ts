import { createApp } from "./app";
import type { Env } from "./env";

const app = createApp();

export default {
  fetch(request, env, context) {
    return app.fetch(request, env, context);
  }
} satisfies ExportedHandler<Env>;
