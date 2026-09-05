const db = require('../config/db');
const { sendCsv } = require('../utils/csv');

/** Trainee starts a new attempt on the manikin (Coach / Check / Certification) */
async function startSession(req, res, next) {
  try {
    const { mode, deviceId, trialNo } = req.body; // mode: coach|check|certification
    const traineeId = req.user.id;

    const { rows } = await db.query(
      `INSERT INTO sessions (trainee_id, device_id, institution_id, mode, trial_no)
       VALUES ($1, $2, $3, $4, COALESCE($5, 1)) RETURNING *`,
      [traineeId, deviceId || null, req.user.institutionId, mode, trialNo]
    );

    res.status(201).json({ session: rows[0] });
  } catch (err) {
    next(err);
  }
}

/** All 11 fixed steps + live completion state for a given session (drives the green/grey dots) */
async function getSessionSteps(req, res, next) {
  try {
    const { sessionId } = req.params;

    const { rows: session } = await db.query(
      `SELECT * FROM sessions WHERE id = $1 AND trainee_id = $2`,
      [sessionId, req.user.id]
    );
    if (session.length === 0) return res.status(404).json({ error: 'Session not found' });

    const { rows: steps } = await db.query(
      `SELECT ps.step_no, ps.title, ps.has_metric, ps.metric_unit,
              sse.completed, sse.metric_value, sse.recorded_at
       FROM procedure_steps ps
       LEFT JOIN session_step_events sse
         ON sse.step_no = ps.step_no AND sse.session_id = $1
       ORDER BY ps.step_no ASC`,
      [sessionId]
    );

    const { rows: metricsRows } = await db.query(
      `SELECT * FROM session_metrics WHERE session_id = $1`,
      [sessionId]
    );

    res.json({ session: session[0], steps, metrics: metricsRows[0] || null });
  } catch (err) {
    next(err);
  }
}

/** Certification history for the logged-in trainee, grouped as Trial 1 / Trial 2 cards */
async function getMyCertifications(req, res, next) {
  try {
    const { rows: certs } = await db.query(
      `SELECT * FROM certifications WHERE trainee_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    const results = [];
    for (const cert of certs) {
      const { rows: trials } = await db.query(
        `SELECT ct.trial_no, sm.*
         FROM certification_trials ct
         JOIN session_metrics sm ON sm.session_id = ct.session_id
         WHERE ct.certification_id = $1
         ORDER BY ct.trial_no ASC`,
        [cert.id]
      );
      results.push({ ...cert, trials });
    }

    res.json({ certifications: results });
  } catch (err) {
    next(err);
  }
}

/** Quick "your progress" summary for the trainee's own home screen */
async function getMySummary(req, res, next) {
  try {
    const { rows: latestRows } = await db.query(
      `SELECT s.mode, s.completed_at, e.smart_score, e.ai_suggestion, e.trainer_final_verdict
       FROM sessions s
       LEFT JOIN evaluations e ON e.session_id = s.id
       WHERE s.trainee_id = $1 AND s.completed_at IS NOT NULL
       ORDER BY s.completed_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    const { rows: countRows } = await db.query(
      `SELECT count(*)::int AS total_sessions FROM sessions WHERE trainee_id = $1 AND completed_at IS NOT NULL`,
      [req.user.id]
    );

    res.json({
      latest: latestRows[0] || null,
      totalSessions: countRows[0].total_sessions,
    });
  } catch (err) {
    next(err);
  }
}

const EXPORT_COLUMNS = [
  { key: 'mode', label: 'Mode' },
  { key: 'trial_no', label: 'Trial #' },
  { key: 'status', label: 'Status' },
  { key: 'started_at', label: 'Started' },
  { key: 'completed_at', label: 'Completed' },
  { key: 'steps_passed', label: 'Steps Passed' },
  { key: 'steps_total', label: 'Steps Total' },
  { key: 'laryngoscope_lift_force', label: 'Laryngoscope Lift Force (psi)' },
  { key: 'time_to_place_ett', label: 'Time To Place ETT (s)' },
  { key: 'ett_location_cm', label: 'ETT Location (cm)' },
  { key: 'total_time_to_intubate', label: 'Total Time To Intubate (s)' },
  { key: 'smart_score', label: 'SMArT Score' },
  { key: 'ai_suggestion', label: 'AI Suggestion' },
  { key: 'trainer_final_verdict', label: 'Trainer Verdict' },
];

/** Download my own session/evaluation history as CSV */
async function exportMyRecords(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT s.mode, s.trial_no, s.status, s.started_at, s.completed_at,
              sm.steps_passed, sm.steps_total, sm.laryngoscope_lift_force, sm.time_to_place_ett,
              sm.ett_location_cm, sm.total_time_to_intubate,
              e.smart_score, e.ai_suggestion, e.trainer_final_verdict
       FROM sessions s
       LEFT JOIN session_metrics sm ON sm.session_id = s.id
       LEFT JOIN evaluations e ON e.session_id = s.id
       WHERE s.trainee_id = $1
       ORDER BY s.started_at DESC`,
      [req.user.id]
    );
    sendCsv(res, `smart-records-${req.user.id}.csv`, rows, EXPORT_COLUMNS);
  } catch (err) {
    next(err);
  }
}

module.exports = { startSession, getSessionSteps, getMyCertifications, getMySummary, exportMyRecords };
