CREATE TABLE weather_provider_usage (
  billing_month TEXT PRIMARY KEY,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE weather_current_snapshots (
  trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  location_name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  time_zone TEXT NOT NULL,
  condition TEXT NOT NULL,
  condition_code INTEGER NOT NULL,
  temperature_c REAL NOT NULL,
  uv_index REAL NOT NULL,
  observed_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE weather_forecast_snapshots (
  trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  forecast_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX weather_current_snapshots_expiry_idx
  ON weather_current_snapshots(expires_at);

CREATE INDEX weather_forecast_snapshots_expiry_idx
  ON weather_forecast_snapshots(expires_at);
