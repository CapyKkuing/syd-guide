import { createApp } from "./app";
import type { Env } from "./env";
import { purgeExpiredTrips } from "./services/purge";

const app = createApp();
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://accounts.google.com https://www.googleapis.com https://cdn.jsdelivr.net https://open.er-api.com https://tiles.openfreemap.org",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "frame-src https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "manifest-src 'self'",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join("; ");

function secure(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export default {
  async fetch(request, env, context) {
    return secure(await app.fetch(request, env, context));
  },
  scheduled(event, env, context) {
    context.waitUntil(
      purgeExpiredTrips(env.DB, new Date(event.scheduledTime).toISOString())
    );
  }
} satisfies ExportedHandler<Env>;
