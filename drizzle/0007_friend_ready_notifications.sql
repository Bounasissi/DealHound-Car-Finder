CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_deliveries_owner_idx ON notification_deliveries (owner_id, created_at);
