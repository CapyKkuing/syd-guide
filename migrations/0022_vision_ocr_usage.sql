CREATE TABLE vision_ocr_usage (
  billing_month TEXT PRIMARY KEY,
  used_pages INTEGER NOT NULL DEFAULT 0 CHECK (used_pages >= 0),
  updated_at TEXT NOT NULL
);
