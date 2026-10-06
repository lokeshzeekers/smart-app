-- Incremental migration for an EXISTING database.
--  1. New alert kind: head_position (laryngoscope introduced while the neck is
--     not in the sniffing position).
--  2. Steps 10 and 11 swap places to match the physical sequence:
--       10 = Insert ETT to 21 cm (F) / 23 cm (M)   (depth reed switches)
--       11 = Remove stylet                          (reed switch, reverse count)
--     NOTE: step events already stored under the old numbering keep their
--     step_no, so for sessions recorded BEFORE this migration steps 10/11 read
--     the other way round. New sessions are unaffected.
--  3. session_step_events.inferred - true when the firmware credited a step
--     that has no sensor (shown as "assumed" in the app).

ALTER TYPE session_alert_kind ADD VALUE IF NOT EXISTS 'head_position';

UPDATE procedure_steps SET title = 'Insert ETT to 21cm (Female) or 23cm (Male)' WHERE step_no = 10;
UPDATE procedure_steps SET title = 'Remove stylet' WHERE step_no = 11;

ALTER TABLE session_step_events ADD COLUMN IF NOT EXISTS inferred BOOLEAN NOT NULL DEFAULT false;
