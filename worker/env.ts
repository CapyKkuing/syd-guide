import type { Principal } from "../src/shared/entities";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SURFACE: "admin" | "partner";
  APP_ORIGIN: string;
  PARTNER_ORIGIN?: string;
  ADMIN_EMAIL?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_AUTH?: "enabled";
  GOOGLE_DRIVE_CLIENT_ID?: string;
  GOOGLE_PLACES_API_KEY?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    principal: Principal;
  };
};
