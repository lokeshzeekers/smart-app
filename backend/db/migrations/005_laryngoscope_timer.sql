-- Incremental migration for an EXISTING database.
-- Laryngoscope timer: the server records when the laryngoscope first entered
-- and when the tube reached depth, and uses the difference as
-- "Total time to intubate" when the firmware doesn't send its own value.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS laryngoscope_entered_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS intubation_completed_at TIMESTAMPTZ;
