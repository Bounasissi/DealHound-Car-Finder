CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT 'primary',
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'SCHEDULED',
  scheduled_at timestamptz,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inspections_owner_listing_unique ON inspections (owner_id, listing_id);
CREATE INDEX IF NOT EXISTS inspections_owner_listing_idx ON inspections (owner_id, listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT 'primary',
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  notes text,
  made_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  target_purchase_price numeric(12, 2),
  maximum_purchase_price numeric(12, 2),
  expected_margin_at_asking numeric(12, 2),
  expected_margin_at_offer numeric(12, 2),
  worst_case_margin_at_asking numeric(12, 2),
  worst_case_margin_at_offer numeric(12, 2),
  payload jsonb
);
CREATE INDEX IF NOT EXISTS offers_owner_listing_idx ON offers (owner_id, listing_id, made_at DESC);

CREATE TABLE IF NOT EXISTS seller_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL DEFAULT 'primary',
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  type text NOT NULL,
  body text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_interactions_owner_listing_idx ON seller_interactions (owner_id, listing_id, occurred_at DESC);
