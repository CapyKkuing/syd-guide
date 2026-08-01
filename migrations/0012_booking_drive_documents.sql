CREATE TABLE trip_booking_storage (
  trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider = 'google-drive'),
  root_object_id TEXT NOT NULL,
  connected_by TEXT NOT NULL REFERENCES members(id),
  connected_at TEXT NOT NULL
);

ALTER TABLE bookings
ADD COLUMN document_provider TEXT CHECK (
  document_provider IS NULL OR document_provider = 'google-drive'
);

ALTER TABLE bookings
ADD COLUMN document_object_id TEXT;

ALTER TABLE bookings
ADD COLUMN document_name TEXT;

ALTER TABLE bookings
ADD COLUMN document_mime_type TEXT CHECK (
  document_mime_type IS NULL OR document_mime_type IN (
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
  )
);
