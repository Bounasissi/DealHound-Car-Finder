ALTER TABLE search_profiles
  ADD COLUMN IF NOT EXISTS max_all_in_ratio numeric(5, 4) NOT NULL DEFAULT 0.8000;

COMMENT ON COLUMN search_profiles.max_all_in_ratio IS
  'Maximum expected all-in acquisition basis divided by conservative finished value.';
