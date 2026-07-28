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
