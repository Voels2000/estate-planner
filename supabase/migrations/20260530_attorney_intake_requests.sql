CREATE TABLE IF NOT EXISTS attorney_intake_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id      UUID REFERENCES attorney_listings(id),
  client_email    TEXT NOT NULL,
  client_name     TEXT,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent', 'opened', 'completed', 'expired')),
  token           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE attorney_intake_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attorney manages own intake requests"
  ON attorney_intake_requests FOR ALL
  USING (attorney_id = auth.uid());

CREATE INDEX IF NOT EXISTS attorney_intake_requests_token_idx
  ON attorney_intake_requests(token);

CREATE INDEX IF NOT EXISTS attorney_intake_requests_attorney_status_idx
  ON attorney_intake_requests(attorney_id, status);
