ALTER TABLE members
ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

ALTER TABLE pair_invites
ADD COLUMN member_id TEXT REFERENCES members(id);

CREATE TABLE app_settings (
  id TEXT PRIMARY KEY CHECK (id = 'app'),
  representative_member_id TEXT NOT NULL REFERENCES members(id),
  setup_completed_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO app_settings (
  id,
  representative_member_id,
  setup_completed_at,
  updated_at
) VALUES ('app', 'owner', NULL, CURRENT_TIMESTAMP);
