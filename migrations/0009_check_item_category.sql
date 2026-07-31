ALTER TABLE check_items
ADD COLUMN category TEXT NOT NULL DEFAULT 'essential' CHECK (
  category IN ('essential', 'reservation', 'packing', 'travel')
);

UPDATE check_items
SET category = 'travel'
WHERE phase = 'travel';
