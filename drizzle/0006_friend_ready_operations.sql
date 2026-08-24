CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  kind text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'QUEUED',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  retry_at timestamptz,
  locked_by text,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_owner_idempotency_unique ON jobs (owner_id, idempotency_key);
CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs (state, retry_at, locked_until, created_at);

CREATE TABLE IF NOT EXISTS usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,
  day text NOT NULL,
  metric text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS usage_owner_day_metric_unique ON usage_counters (owner_id, day, metric);
