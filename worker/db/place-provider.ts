import type { PlaceProviderSku, PlaceProviderUsage } from "../../src/shared/places";
import type { Env } from "../env";

export const PLACE_PROVIDER_LIMIT = 800;

export async function reservePlaceProviderUsage(
  env: Env,
  sku: PlaceProviderSku,
  now: Date
): Promise<PlaceProviderUsage | null> {
  const month = billingMonth(now);
  const row = await env.DB.prepare(
    `INSERT INTO place_provider_usage (billing_month, sku, used_count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT (billing_month, sku) DO UPDATE SET
       used_count = used_count + 1,
       updated_at = excluded.updated_at
     WHERE used_count < ?
     RETURNING used_count`
  ).bind(month, sku, now.toISOString(), PLACE_PROVIDER_LIMIT)
    .first<{ used_count: number }>();
  return row ? { sku, used: Number(row.used_count), limit: PLACE_PROVIDER_LIMIT } : null;
}

export async function listPlaceProviderUsage(
  env: Env,
  now: Date
): Promise<PlaceProviderUsage[]> {
  const { results } = await env.DB.prepare(
    "SELECT sku, used_count FROM place_provider_usage WHERE billing_month = ?"
  ).bind(billingMonth(now)).all<{ sku: PlaceProviderSku; used_count: number }>();
  const counts = new Map(results.map((row) => [row.sku, Number(row.used_count)]));
  return [
    "text-search-enterprise",
    "place-details-enterprise",
    "nearby-search-enterprise",
    "place-photo",
  ].map((sku) => ({
    sku: sku as PlaceProviderSku,
    used: counts.get(sku as PlaceProviderSku) ?? 0,
    limit: PLACE_PROVIDER_LIMIT,
  }));
}

function billingMonth(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}
