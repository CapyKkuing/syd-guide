export async function purgeExpiredTrips(
  db: D1Database,
  now: string
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM trips
       WHERE deleted_at IS NOT NULL
         AND purge_after IS NOT NULL
         AND purge_after <= ?`
    )
    .bind(now)
    .run();
  return result.meta.changes;
}

export async function purgeExpiredWeatherSnapshots(
  db: D1Database,
  scheduledAt: string
): Promise<number> {
  const scheduledTime = Date.parse(scheduledAt);
  if (!Number.isFinite(scheduledTime)) {
    throw new Error("Scheduled weather purge time is invalid");
  }
  const cutoff = new Date(scheduledTime).toISOString();
  const results = await db.batch([
    db.prepare(
      "DELETE FROM weather_current_snapshots WHERE expires_at <= ?"
    ).bind(cutoff),
    db.prepare(
      "DELETE FROM weather_forecast_snapshots WHERE expires_at <= ?"
    ).bind(cutoff),
  ]);
  return (results[0]?.meta.changes ?? 0) + (results[1]?.meta.changes ?? 0);
}
