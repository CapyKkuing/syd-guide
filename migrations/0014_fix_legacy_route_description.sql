UPDATE places
SET
  description = '일정 동선 장소',
  version = version + 1,
  updated_by = 'owner',
  updated_at = CURRENT_TIMESTAMP
WHERE trip_id = 'legacy-sydney-2026'
  AND id LIKE 'route-%';

UPDATE trips
SET
  version = version + 1,
  sync_version = sync_version + 1,
  updated_by = 'owner',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'legacy-sydney-2026';
