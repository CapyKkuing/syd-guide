CREATE TABLE trip_media_storage (
  trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'google-drive'),
  root_object_id TEXT NOT NULL,
  connected_by TEXT NOT NULL REFERENCES members(id),
  connected_at TEXT NOT NULL
);

CREATE TABLE trip_media (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind = 'photo'),
  provider TEXT NOT NULL CHECK (provider = 'google-drive'),
  provider_object_id TEXT NOT NULL,
  thumbnail_object_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  captured_at TEXT,
  ai_score REAL,
  ai_labels_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_object_id)
);

CREATE INDEX idx_trip_media_trip_created
  ON trip_media (trip_id, created_at DESC, id);
