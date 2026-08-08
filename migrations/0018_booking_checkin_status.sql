ALTER TABLE bookings
ADD COLUMN usage_status TEXT NOT NULL DEFAULT 'booked'
CHECK (usage_status IN ('booked', 'check_in_pending', 'checked_in', 'used', 'cancelled'));
