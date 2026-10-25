ALTER TABLE alerts ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'PENDING';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS delivery_error text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
