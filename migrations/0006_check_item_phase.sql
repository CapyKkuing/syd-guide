ALTER TABLE check_items
ADD COLUMN phase TEXT NOT NULL DEFAULT 'pretrip' CHECK (
  phase IN ('pretrip', 'travel')
);
