ALTER TABLE videos ADD COLUMN source_type TEXT NOT NULL DEFAULT 'telegram_file';
ALTER TABLE videos ADD COLUMN source_url TEXT;
