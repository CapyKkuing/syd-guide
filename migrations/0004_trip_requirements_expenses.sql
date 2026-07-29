ALTER TABLE bookings
ADD COLUMN is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1));

ALTER TABLE check_items
ADD COLUMN requirement_kind TEXT CHECK (
  requirement_kind IN ('passport', 'essential')
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('pretrip', 'travel')),
  category TEXT NOT NULL CHECK (
    category IN (
      'flight',
      'lodging',
      'reservation',
      'food',
      'transport',
      'shopping',
      'activity',
      'other'
    )
  ),
  title TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (
    length(currency) = 3 AND currency = upper(currency)
  ),
  spent_on TEXT NOT NULL,
  paid_by_member_id TEXT NOT NULL REFERENCES members(id),
  is_settled INTEGER NOT NULL DEFAULT 0 CHECK (is_settled IN (0, 1)),
  memo TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL REFERENCES members(id),
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_expenses_trip_date
ON expenses(trip_id, spent_on DESC, id);

CREATE INDEX idx_expenses_trip_settlement
ON expenses(trip_id, is_settled, spent_on DESC);
