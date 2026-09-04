-- =====================================================================
-- SMArT - Simulation-based Management of Airway Training
-- PostgreSQL production schema
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Institutions (IIT-M, Apollo, AIIMS, JIPMER ... tabs on trainer dash)
-- ---------------------------------------------------------------------
CREATE TABLE institutions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL UNIQUE,
    short_code      VARCHAR(20)  NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Users (base identity for both trainee & trainer, role-based)
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('trainee', 'trainer', 'admin');

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255),              -- null if only OTP/identity login used
    full_name           VARCHAR(150) NOT NULL,
    role                user_role NOT NULL,
    institution_id      UUID REFERENCES institutions(id) ON DELETE SET NULL,
    avatar_url          TEXT,
    apaar_id            VARCHAR(50)  UNIQUE,        -- mocked identity linkage
    aadhaar_ref_token   VARCHAR(100) UNIQUE,        -- NEVER store raw Aadhaar, only a reference/verification token
    is_verified         BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_institution ON users(institution_id);
CREATE INDEX idx_users_role ON users(role);

-- One-time-password table for email/mobile OTP login
CREATE TABLE otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    email       VARCHAR(255) NOT NULL,
    code_hash   VARCHAR(255) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed    BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- ESP32 Manikin Devices
-- ---------------------------------------------------------------------
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_uid      VARCHAR(80) NOT NULL UNIQUE,   -- burned-in ESP32 chip id
    label           VARCHAR(120),
    institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
    api_key_hash    VARCHAR(255) NOT NULL,          -- device auth, rotate-able
    last_seen_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- The 11 fixed procedure steps (seeded once, referenced everywhere)
-- ---------------------------------------------------------------------
CREATE TABLE procedure_steps (
    step_no         SMALLINT PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    has_metric      BOOLEAN NOT NULL DEFAULT false,  -- e.g. step 7 carries a psi value
    metric_unit     VARCHAR(20)
);

-- ---------------------------------------------------------------------
-- Sessions: one attempt at the manikin, in one of three modes
-- ---------------------------------------------------------------------
CREATE TYPE session_mode AS ENUM ('coach', 'check', 'certification');
CREATE TYPE session_status AS ENUM ('in_progress', 'completed', 'abandoned');

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainee_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
    mode            session_mode NOT NULL,
    trial_no        SMALLINT NOT NULL DEFAULT 1,     -- Trial 1 / Trial 2 ... (certification mode)
    status          session_status NOT NULL DEFAULT 'in_progress',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_sessions_trainee ON sessions(trainee_id);
CREATE INDEX idx_sessions_mode ON sessions(mode);

-- Live per-step progress pushed by the ESP32 (green dot / grey dot in UI)
CREATE TABLE session_step_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    step_no         SMALLINT NOT NULL REFERENCES procedure_steps(step_no),
    completed       BOOLEAN NOT NULL DEFAULT true,
    metric_value    NUMERIC(10,2),                    -- e.g. 22 (psi)
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, step_no)
);

-- Final measured outcome values per session (Check / Certification cards)
CREATE TABLE session_metrics (
    session_id              UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    laryngoscope_lift_force NUMERIC(6,2),   -- psi
    time_to_place_ett       NUMERIC(6,2),   -- seconds
    ett_location_cm         NUMERIC(6,2),   -- cm offset from target (+/-)
    total_time_to_intubate  NUMERIC(6,2),   -- seconds
    steps_passed            SMALLINT,
    steps_total             SMALLINT NOT NULL DEFAULT 11
);

-- ---------------------------------------------------------------------
-- Threshold configuration used to auto-classify Pass / Fail / Bad Technique
-- ---------------------------------------------------------------------
CREATE TABLE scoring_thresholds (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id              UUID REFERENCES institutions(id) ON DELETE CASCADE,
    max_lift_force_psi          NUMERIC(6,2) NOT NULL DEFAULT 22,
    max_time_to_place_ett_sec   NUMERIC(6,2) NOT NULL DEFAULT 2.5,
    max_ett_location_offset_cm  NUMERIC(6,2) NOT NULL DEFAULT 1.0,
    max_total_time_sec          NUMERIC(6,2) NOT NULL DEFAULT 70,
    min_steps_passed            SMALLINT NOT NULL DEFAULT 10,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- AI Suggestion + Trainer Review (drives the "SMART Score for Review" list)
-- ---------------------------------------------------------------------
CREATE TYPE ai_suggestion AS ENUM ('pass', 'bad_technique', 'fail');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'overridden');

CREATE TABLE evaluations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    smart_score          SMALLINT NOT NULL,              -- 0-10 shown next to trainee name
    ai_suggestion       ai_suggestion NOT NULL,
    ai_notes            TEXT,                             -- "Rushed, excess pressure on teeth"
    review_status       review_status NOT NULL DEFAULT 'pending',
    reviewed_by         UUID REFERENCES users(id),
    trainer_final_verdict ai_suggestion,
    trainer_comments    TEXT,
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_status ON evaluations(review_status);

-- ---------------------------------------------------------------------
-- Certification: aggregate of trials (Trial 1, Trial 2 shown as cards)
-- ---------------------------------------------------------------------
CREATE TABLE certifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainee_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
    final_verdict   ai_suggestion,
    certified_at    TIMESTAMPTZ,
    certified_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE certification_trials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id    UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    trial_no            SMALLINT NOT NULL,
    UNIQUE (certification_id, trial_no)
);

-- ---------------------------------------------------------------------
-- Notifications (bell icon, badge count on trainer dashboard)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- ---------------------------------------------------------------------
-- updated_at auto-touch trigger (users table)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
