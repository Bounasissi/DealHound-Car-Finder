UPDATE alerts
SET alert_key = listing_id::text || ':qualifying:' || COALESCE(payload->>'price', 'unknown');
WITH ranked AS (
  SELECT ctid, row_number() OVER (PARTITION BY owner_id, alert_key ORDER BY delivered DESC, created_at, id) AS row_number
  FROM alerts
)
DELETE FROM alerts AS duplicate
USING ranked
WHERE duplicate.ctid = ranked.ctid AND ranked.row_number > 1;
