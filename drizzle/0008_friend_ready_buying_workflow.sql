CREATE TABLE IF NOT EXISTS inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  result text NOT NULL DEFAULT 'NOT_CHECKED',
  note text,
  checked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS inspection_items_code_unique ON inspection_items (inspection_id, code);

ALTER TABLE offers ADD COLUMN IF NOT EXISTS target_purchase_price numeric(12, 2);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS maximum_purchase_price numeric(12, 2);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS expected_margin_at_asking numeric(12, 2);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS expected_margin_at_offer numeric(12, 2);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS worst_case_margin_at_asking numeric(12, 2);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS worst_case_margin_at_offer numeric(12, 2);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS payload jsonb;

CREATE TABLE IF NOT EXISTS listing_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES evaluations(id) ON DELETE SET NULL,
  category text NOT NULL,
  message text NOT NULL,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
