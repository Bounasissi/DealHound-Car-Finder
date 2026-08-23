ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS formula_version text NOT NULL DEFAULT 'deal-score-v1';
CREATE TEMP TABLE listing_dedup_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY owner_id, source_id, source_listing_id
      ORDER BY (workflow_stage <> 'REJECTED') DESC, last_seen_at DESC, created_at ASC, id
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY owner_id, source_id, source_listing_id
      ORDER BY (workflow_stage <> 'REJECTED') DESC, last_seen_at DESC, created_at ASC, id
    ) AS row_number
  FROM listings
  WHERE source_listing_id IS NOT NULL
)
SELECT id AS duplicate_id, keeper_id
FROM ranked
WHERE row_number > 1;

UPDATE evaluations AS child
SET listing_id = map.keeper_id
FROM listing_dedup_map AS map
WHERE child.listing_id = map.duplicate_id;

UPDATE valuations AS child
SET listing_id = map.keeper_id
FROM listing_dedup_map AS map
WHERE child.listing_id = map.duplicate_id;

UPDATE history_checks AS child
SET listing_id = map.keeper_id
FROM listing_dedup_map AS map
WHERE child.listing_id = map.duplicate_id;

UPDATE user_issues AS child
SET listing_id = map.keeper_id
FROM listing_dedup_map AS map
WHERE child.listing_id = map.duplicate_id;

UPDATE alerts AS child
SET listing_id = map.keeper_id
FROM listing_dedup_map AS map
WHERE child.listing_id = map.duplicate_id;

UPDATE outcomes AS child
SET listing_id = map.keeper_id
FROM listing_dedup_map AS map
WHERE child.listing_id = map.duplicate_id;

DELETE FROM listings AS duplicate
USING listing_dedup_map AS map
WHERE duplicate.id = map.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS listings_owner_source_listing_unique
  ON listings (owner_id, source_id, source_listing_id)
  WHERE source_listing_id IS NOT NULL;
