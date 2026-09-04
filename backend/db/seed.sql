-- Seed: the 11 fixed intubation procedure steps (from Coach/Check screens)
INSERT INTO procedure_steps (step_no, title, has_metric, metric_unit) VALUES
 (1,  'Position yourself for the intubation', false, NULL),
 (2,  'Place the patient in "Sniffing Position"', false, NULL),
 (3,  'Introduce laryngoscope on your right', false, NULL),
 (4,  'Sweep tongue to the left', false, NULL),
 (5,  'Place laryngoscope tip in Vallecula', false, NULL),
 (6,  'Do not press on teeth', false, NULL),
 (7,  'Use sufficient force to open airway', true, 'psi'),
 (8,  'Do you see the vocal cords', false, NULL),
 (9,  'Advance ET tube through the vocal cords', false, NULL),
 (10, 'Remove stylet', false, NULL),
 (11, 'Insert ETT to 21cm (Female) or 23cm (Male)', false, NULL)
ON CONFLICT (step_no) DO NOTHING;

-- Seed: demo institutions (as seen in the trainer dashboard tabs)
INSERT INTO institutions (name, short_code) VALUES
 ('IIT Madras', 'IIT-M'),
 ('Apollo Hospitals', 'Apollo'),
 ('AIIMS', 'AIIMS'),
 ('JIPMER', 'JIPMER')
ON CONFLICT (short_code) DO NOTHING;

-- Seed: default scoring thresholds (global, institution_id NULL = fallback)
INSERT INTO scoring_thresholds
 (institution_id, max_lift_force_psi, max_time_to_place_ett_sec, max_ett_location_offset_cm, max_total_time_sec, min_steps_passed)
VALUES
 (NULL, 22, 2.5, 1.0, 70, 10);
