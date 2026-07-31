ALTER TABLE expenses
ADD COLUMN personal_for_member_id TEXT REFERENCES members(id);
