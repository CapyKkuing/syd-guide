PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('owner', 'partner')),
  display_name TEXT NOT NULL,
  access_email TEXT UNIQUE,
  created_at TEXT NOT NULL
);

INSERT INTO members (id, role, display_name, access_email, created_at)
VALUES
  ('owner', 'owner', '나', NULL, CURRENT_TIMESTAMP),
  ('partner', 'partner', '여자친구', NULL, CURRENT_TIMESTAMP);

CREATE TABLE pair_invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES members(id),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  invite_id TEXT NOT NULL UNIQUE REFERENCES pair_invites(id),
  token_hash TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'completed')),
  cover_image_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  sync_version INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  purge_after TEXT,
  created_by TEXT NOT NULL REFERENCES members(id),
  updated_by TEXT NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE trip_members (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, member_id)
);

CREATE TABLE trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_date TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL,
  UNIQUE (trip_id, day_date)
);

CREATE TABLE places (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('restaurant', 'cafe', 'attraction', 'lodging', 'transport')
  ),
  status TEXT NOT NULL CHECK (status IN ('saved', 'maybe', 'visited')),
  address TEXT,
  latitude REAL,
  longitude REAL,
  map_url TEXT,
  source_url TEXT,
  image_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  saved_by TEXT REFERENCES members(id),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_id TEXT REFERENCES places(id),
  booking_type TEXT NOT NULL CHECK (
    booking_type IN (
      'flight',
      'lodging',
      'ticket',
      'tour',
      'transport',
      'restaurant',
      'other'
    )
  ),
  provider TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  reservation_code TEXT,
  payment_status TEXT NOT NULL CHECK (
    payment_status IN ('unpaid', 'partial', 'paid', 'refunded')
  ),
  external_url TEXT,
  document_url TEXT,
  memo TEXT NOT NULL DEFAULT '',
  is_fixed INTEGER NOT NULL DEFAULT 1 CHECK (is_fixed IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE schedule_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_day_id TEXT NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
  place_id TEXT REFERENCES places(id),
  booking_id TEXT REFERENCES bookings(id),
  title TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  memo TEXT NOT NULL DEFAULT '',
  travel_mode TEXT CHECK (
    travel_mode IN ('walk', 'transit', 'drive', 'ferry', 'other')
  ),
  travel_note TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  is_fixed INTEGER NOT NULL DEFAULT 0 CHECK (is_fixed IN (0, 1)),
  is_done INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE check_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('shared', 'personal')),
  owner_member_id TEXT REFERENCES members(id),
  assignee_member_id TEXT REFERENCES members(id),
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  memo TEXT NOT NULL DEFAULT '',
  is_done INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  position INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (
    target_type IN ('trip', 'schedule_item', 'place', 'booking')
  ),
  target_id TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('shared', 'personal')),
  author_member_id TEXT NOT NULL REFERENCES members(id),
  body TEXT NOT NULL,
  attachment_url TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('place', 'schedule_item')),
  target_id TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  choice TEXT NOT NULL CHECK (choice IN ('must', 'okay', 'skip')),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL,
  UNIQUE (target_type, target_id, member_id)
);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE mutation_receipts (
  idempotency_key TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id),
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_token ON device_sessions(token_hash);
CREATE INDEX idx_sessions_member ON device_sessions(member_id, revoked_at);
CREATE INDEX idx_trips_deleted ON trips(deleted_at, purge_after);
CREATE INDEX idx_trip_days_trip ON trip_days(trip_id, position);
CREATE INDEX idx_schedule_trip_day
  ON schedule_items(trip_id, trip_day_id, position);
CREATE INDEX idx_places_trip ON places(trip_id, category, status);
CREATE INDEX idx_bookings_trip_time ON bookings(trip_id, starts_at);
CREATE INDEX idx_checks_trip ON check_items(trip_id, scope, position);
CREATE INDEX idx_notes_trip ON notes(trip_id, target_type, target_id);
CREATE INDEX idx_activity_trip_time
  ON activity_logs(trip_id, created_at DESC);
