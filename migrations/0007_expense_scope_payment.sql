ALTER TABLE expenses
ADD COLUMN expense_scope TEXT CHECK (expense_scope IN ('shared', 'personal'));

ALTER TABLE expenses
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('cash', 'card'));
