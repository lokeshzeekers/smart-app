-- Incremental migration for an EXISTING database.
-- (backend/db/schema.sql has been updated to match for fresh installs -
--  running that whole file again against a DB that already has these
--  tables will fail on "already exists". Run this file instead if you
--  already have data.)

-- 1. Trainer -> trainee ownership
ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_trainer ON users(trainer_id);

-- 2. Real-time alert log (wrong path / over depth / end point / teeth contact)
DO $$ BEGIN
  CREATE TYPE session_alert_kind AS ENUM
      ('wrong_path', 'correct_path', 'teeth_contact', 'over_depth', 'end_point', 'process_complete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS session_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    kind            session_alert_kind NOT NULL,
    detail          JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_alerts_session ON session_alerts(session_id, created_at);

-- 3. NOTE: any trainee rows that were previously auto-created by the old
-- "sign in with any email" OTP flow will have trainer_id = NULL. Either
-- assign them to a trainer manually or delete the stale ones:
--   UPDATE users SET trainer_id = '<some-trainer-uuid>' WHERE role = 'trainee' AND trainer_id IS NULL;
