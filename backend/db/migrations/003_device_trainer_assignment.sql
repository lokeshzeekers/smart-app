-- Incremental migration for an EXISTING database.
-- Adds trainer<->manikin assignment (was completely missing before - every
-- device was visible to every trainee regardless of who their trainer was).

ALTER TABLE devices ADD COLUMN IF NOT EXISTS assigned_trainer_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_devices_trainer ON devices(assigned_trainer_id);

-- Existing devices default to NULL (shared/unassigned - visible to every
-- trainee until an admin assigns them to a specific trainer).
