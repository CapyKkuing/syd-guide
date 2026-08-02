ALTER TABLE place_provider_usage RENAME TO place_provider_usage_legacy;

CREATE TABLE place_provider_usage (
  billing_month TEXT NOT NULL,
  sku TEXT NOT NULL CHECK (
    sku IN (
      'text-search-enterprise',
      'place-details-enterprise',
      'nearby-search-enterprise',
      'place-photo'
    )
  ),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (billing_month, sku)
);

INSERT INTO place_provider_usage (billing_month, sku, used_count, updated_at)
SELECT billing_month, sku, used_count, updated_at
FROM place_provider_usage_legacy;

DROP TABLE place_provider_usage_legacy;
