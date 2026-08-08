CREATE TABLE settlement_expense_claims (
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  settlement_group_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, expense_id)
);

CREATE INDEX idx_settlement_expense_claims_group
ON settlement_expense_claims(trip_id, settlement_group_id);
