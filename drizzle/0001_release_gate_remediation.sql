ALTER TABLE search_profiles ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE valuations ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE history_checks ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE user_issues ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS owner_id text NOT NULL DEFAULT 'primary';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_key text;
UPDATE alerts SET alert_key = listing_id::text || ':qualifying:' || COALESCE(payload->>'price', 'unknown') WHERE alert_key IS NULL;
ALTER TABLE alerts ALTER COLUMN alert_key SET NOT NULL;
WITH ranked AS (
  SELECT ctid, row_number() OVER (PARTITION BY owner_id, alert_key ORDER BY delivered DESC, created_at, id) AS row_number
  FROM alerts
)
DELETE FROM alerts AS duplicate
USING ranked
WHERE duplicate.ctid = ranked.ctid AND ranked.row_number > 1;
CREATE UNIQUE INDEX IF NOT EXISTS alerts_owner_key_unique ON alerts (owner_id, alert_key);
