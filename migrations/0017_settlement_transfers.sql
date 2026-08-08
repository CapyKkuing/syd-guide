CREATE TABLE settlement_transfers (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  settlement_group_id TEXT NOT NULL,
  expense_ids_json TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (length(currency) = 3),
  from_member_id TEXT NOT NULL REFERENCES members(id),
  to_member_id TEXT NOT NULL REFERENCES members(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  completed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_settlement_transfers_trip_group
ON settlement_transfers(trip_id, settlement_group_id, status);
