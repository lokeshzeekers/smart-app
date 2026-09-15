-- Incremental migration for an EXISTING database.
-- Lets a trainer pin one of their own trainees to a specific manikin,
-- narrower than "any device assigned to me / unassigned devices".

ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_device_id UUID REFERENCES devices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_assigned_device ON users(assigned_device_id);
