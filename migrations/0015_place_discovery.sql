ALTER TABLE places ADD COLUMN is_recommended INTEGER NOT NULL DEFAULT 0
  CHECK (is_recommended IN (0, 1));

ALTER TABLE places ADD COLUMN is_saved INTEGER NOT NULL DEFAULT 1
  CHECK (is_saved IN (0, 1));

ALTER TABLE places ADD COLUMN provider TEXT
  CHECK (provider IS NULL OR provider = 'google-places');

ALTER TABLE places ADD COLUMN provider_place_id TEXT;

UPDATE places
SET is_recommended = 1,
    is_saved = 0,
    saved_by = NULL
WHERE id LIKE 'legacy-food-%'
   OR id LIKE 'legacy-cafe-%';

CREATE UNIQUE INDEX idx_places_provider
  ON places(trip_id, provider, provider_place_id)
  WHERE provider_place_id IS NOT NULL;

CREATE TABLE place_provider_usage (
  billing_month TEXT NOT NULL,
  sku TEXT NOT NULL CHECK (
    sku IN ('text-search-enterprise', 'place-details-enterprise', 'place-photo')
  ),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (billing_month, sku)
);
