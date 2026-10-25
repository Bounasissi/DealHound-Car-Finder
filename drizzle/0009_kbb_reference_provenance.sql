ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS require_kbb_reference boolean NOT NULL DEFAULT true;
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'UNKNOWN';
