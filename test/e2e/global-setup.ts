import { request } from "@playwright/test";
import { BASE_URL, ensureE2eParticipants } from "./helpers";

export default async function globalSetup(): Promise<void> {
  const context = await request.newContext({ baseURL: BASE_URL });
  try {
    await ensureE2eParticipants(context);
  } finally {
    await context.dispose();
  }
}
