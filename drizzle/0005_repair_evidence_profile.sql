ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS require_repair_evidence boolean NOT NULL DEFAULT true;
