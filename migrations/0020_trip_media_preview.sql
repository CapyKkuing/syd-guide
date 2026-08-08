ALTER TABLE trip_media ADD COLUMN preview_crop_aspect TEXT NOT NULL DEFAULT '4:3'
  CHECK (preview_crop_aspect IN ('1:1', '4:3', '3:4', '16:9'));
ALTER TABLE trip_media ADD COLUMN preview_brightness INTEGER NOT NULL DEFAULT 0
  CHECK (preview_brightness BETWEEN -20 AND 20);
