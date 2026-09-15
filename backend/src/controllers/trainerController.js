const db = require('../config/db');
const { sendTraineeWelcomeEmail } = require('../utils/mailer');
const { sendRecordsReport } = require('../utils/xlsx-report');

/** Manikins this trainer can actually offer their trainees: either
 * explicitly assigned to them by an admin, or left unassigned/shared. */
async function listMyDevices(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT id, device_uid, label FROM devices
       WHERE is_active = true AND (assigned_trainer_id IS NULL OR assigned_trainer_id = $1)
       ORDER BY label`,
      [req.user.id]
    );
    res.json({ devices: rows });
  } catch (err) {
    next(err);
  }
}

/** Pin (or unpin, with deviceId: null) one of this trainer's own trainees
 * to a specific manikin from the trainer's own pool. */
async function assignTraineeDevice(req, res, next) {
  try {
    const { traineeId } = req.params;
    const { deviceId } = req.body;

    const { rows: traineeCheck } = await db.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'trainee' AND trainer_id = $2`,
      [traineeId, req.user.id]
    );
    if (traineeCheck.length === 0) return res.status(404).json({ error: 'Trainee not found in your roster' });

    if (deviceId) {
      const { rows: deviceCheck } = await db.query(
        `SELECT id FROM devices WHERE id = $1 AND is_active = true AND (assigned_trainer_id IS NULL OR assigned_trainer_id = $2)`,
        [deviceId, req.user.id]
      );
      if (deviceCheck.length === 0) return res.status(400).json({ error: 'That manikin is not available to you' });
    }

    await db.query(`UPDATE users SET assigned_device_id = $2 WHERE id = $1`, [traineeId, deviceId || null]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** Trainer registers a trainee under their own roster (email OTP login, no password) */
async function registerTrainee(req, res, next) {
  try {
    const { email, fullName } = req.body;
    if (!email || !fullName) return res.status(400).json({ error: 'email and fullName are required' });

    const { rows: existing } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const existingUser = existing[0];

    if (existingUser) {
      // Re-registering a previously-removed trainee's email restores their
      // access (and yours to their records) instead of erroring out - this
      // is the intended way to bring someone back after "Remove" on the
      // roster, since Remove only deactivates rather than deleting them.
      const wasRemovedByThisTrainer =
        existingUser.role === 'trainee' && !existingUser.is_active && existingUser.trainer_id === req.user.id;

      if (!wasRemovedByThisTrainer) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }

      const { rows: reactivated } = await db.query(
        `UPDATE users SET is_active = true, full_name = $2 WHERE id = $1
         RETURNING id, email, full_name, created_at`,
        [existingUser.id, fullName]
      );

      const delivered = await sendTraineeWelcomeEmail(email, fullName);
      return res.status(200).json({
        trainee: reactivated[0],
        message: delivered ? 'Trainee re-registered and notified by email' : 'Trainee re-registered (email delivery not configured on this server)',
      });
    }

    const { rows } = await db.query(
      `INSERT INTO users (email, full_name, role, trainer_id, is_verified)
       VALUES ($1, $2, 'trainee', $3, false)
       RETURNING id, email, full_name, created_at`,
      [email, fullName, req.user.id]
    );

    const delivered = await sendTraineeWelcomeEmail(email, fullName);

    res.status(201).json({
      trainee: rows[0],
      message: delivered ? 'Trainee registered and notified by email' : 'Trainee registered (email delivery not configured on this server)',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * This trainer's own roster, each row with their most recent session's
 * outcome so the trainer can see performance at a glance without opening
 * every trainee individually.
 */
async function listTrainees(req, res, next) {
  try {
    const { rows } = await db.query(
      `SELECT
          u.id, u.full_name, u.email, u.avatar_url, u.is_verified, u.created_at,
          latest.smart_score, latest.ai_suggestion, latest.review_status,
          latest.mode, latest.session_completed_at
       FROM users u
       LEFT JOIN LATERAL (
          SELECT e.smart_score, e.ai_suggestion, e.review_status, s.mode, s.completed_at AS session_completed_at
          FROM sessions s
          JOIN evaluations e ON e.session_id = s.id
          WHERE s.trainee_id = u.id
          ORDER BY s.completed_at DESC NULLS LAST
          LIMIT 1
       ) latest ON true
       WHERE u.role = 'trainee' AND u.trainer_id = $1 AND u.is_active = true
       ORDER BY u.created_at DESC`,
      [req.user.id]
    );
    res.json({ trainees: rows });
  } catch (err) {
    next(err);
  }
}

/** Full session/evaluation history for one of this trainer's trainees */
async function getTraineePerformance(req, res, next) {
  try {
    const { traineeId } = req.params;

    const { rows: traineeRows } = await db.query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.created_at, u.assigned_device_id, d.label AS assigned_device_label
       FROM users u
       LEFT JOIN devices d ON d.id = u.assigned_device_id
       WHERE u.id = $1 AND u.role = 'trainee' AND (u.trainer_id = $2 OR $3 = true)`,
      [traineeId, req.user.id, req.user.role === 'admin']
    );
    if (traineeRows.length === 0) return res.status(404).json({ error: 'Trainee not found in your roster' });

    const { rows: sessions } = await db.query(
      `SELECT s.id AS session_id, s.mode, s.trial_no, s.status, s.started_at, s.completed_at,
              sm.steps_passed, sm.steps_total, sm.laryngoscope_lift_force, sm.time_to_place_ett,
              sm.ett_location_cm, sm.total_time_to_intubate,
              e.id AS evaluation_id, e.smart_score, e.ai_suggestion, e.review_status, e.trainer_final_verdict
       FROM sessions s
       LEFT JOIN session_metrics sm ON sm.session_id = s.id
       LEFT JOIN evaluations e ON e.session_id = s.id
       WHERE s.trainee_id = $1
       ORDER BY s.started_at DESC`,
      [traineeId]
    );

    res.json({ trainee: traineeRows[0], sessions });
  } catch (err) {
    next(err);
  }
}

/**
 * "SMArT Score for Review" list — scoped to this trainer's own registered
 * trainees only (admins see everyone's pending reviews across all trainers).
 */
async function getReviewQueue(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    const params = isAdmin ? [] : [req.user.id];

    const { rows } = await db.query(
      `SELECT
          e.id AS evaluation_id,
          u.id AS trainee_id,
          u.full_name,
          u.avatar_url,
          e.smart_score,
          e.ai_suggestion,
          e.ai_notes,
          e.review_status,
          sm.steps_passed,
          sm.steps_total,
          s.mode
       FROM evaluations e
       JOIN sessions s ON s.id = e.session_id
       JOIN users u ON u.id = s.trainee_id
       LEFT JOIN session_metrics sm ON sm.session_id = s.id
       WHERE e.review_status = 'pending' ${isAdmin ? '' : 'AND u.trainer_id = $1'}
       ORDER BY e.created_at DESC`,
      params
    );

    res.json({ queue: rows });
  } catch (err) {
    next(err);
  }
}

/** Full detail view when a trainer taps "Review" on a trainee row */
async function getEvaluationDetail(req, res, next) {
  try {
    const { evaluationId } = req.params;

    const { rows } = await db.query(
      `SELECT e.*, s.id AS session_id, s.mode, s.trial_no, u.full_name, u.avatar_url
       FROM evaluations e
       JOIN sessions s ON s.id = e.session_id
       JOIN users u ON u.id = s.trainee_id
       WHERE e.id = $1`,
      [evaluationId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Evaluation not found' });
    const evaluation = rows[0];

    const { rows: steps } = await db.query(
      `SELECT ps.step_no, ps.title, ps.has_metric, ps.metric_unit,
              sse.completed, sse.metric_value
       FROM procedure_steps ps
       LEFT JOIN session_step_events sse
         ON sse.step_no = ps.step_no AND sse.session_id = $1
       ORDER BY ps.step_no ASC`,
      [evaluation.session_id]
    );

    const { rows: metrics } = await db.query(
      `SELECT * FROM session_metrics WHERE session_id = $1`,
      [evaluation.session_id]
    );

    res.json({ evaluation, steps, metrics: metrics[0] || null });
  } catch (err) {
    next(err);
  }
}

/** Trainer approves the AI suggestion or overrides it with their own verdict */
async function submitReview(req, res, next) {
  try {
    const { evaluationId } = req.params;
    const { verdict, comments } = req.body; // verdict: pass|bad_technique|fail
    const trainerId = req.user.id;

    const { rows } = await db.query(
      `SELECT ai_suggestion FROM evaluations WHERE id = $1`,
      [evaluationId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Evaluation not found' });

    const status = verdict === rows[0].ai_suggestion ? 'approved' : 'overridden';

    const { rows: updated } = await db.query(
      `UPDATE evaluations
       SET review_status = $1, reviewed_by = $2, trainer_final_verdict = $3,
           trainer_comments = $4, reviewed_at = now()
       WHERE id = $5 RETURNING *`,
      [status, trainerId, verdict, comments || null, evaluationId]
    );

    res.json({ evaluation: updated[0] });
  } catch (err) {
    next(err);
  }
}

/** Remove a trainee from this trainer's active roster. This deactivates
 * rather than hard-deletes: sessions/evaluations reference trainee_id with
 * ON DELETE CASCADE, so a real delete would wipe their entire training
 * history. Deactivated trainees drop out of the roster and can no longer
 * log in, but their records are preserved for audit/certification purposes.
 */
async function removeTrainee(req, res, next) {
  try {
    const { traineeId } = req.params;
    const { rows } = await db.query(
      `UPDATE users SET is_active = false
       WHERE id = $1 AND role = 'trainee' AND (trainer_id = $2 OR $3 = true)
       RETURNING id`,
      [traineeId, req.user.id, req.user.role === 'admin']
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Trainee not found in your roster' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** Trainer downloads one of their trainees' session/evaluation history as a formatted .xlsx report */
async function exportTraineeRecords(req, res, next) {
  try {
    const { traineeId } = req.params;

    const { rows: traineeRows } = await db.query(
      `SELECT id, full_name, email FROM users
       WHERE id = $1 AND role = 'trainee' AND (trainer_id = $2 OR $3 = true)`,
      [traineeId, req.user.id, req.user.role === 'admin']
    );
    if (traineeRows.length === 0) return res.status(404).json({ error: 'Trainee not found in your roster' });

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
      [traineeId]
    );

    const { rows: reviewerRows } = await db.query(`SELECT full_name FROM users WHERE id = $1`, [req.user.id]);
    const safeName = traineeRows[0].full_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    await sendRecordsReport(res, `smart-records-${safeName}.xlsx`, {
      subjectName: traineeRows[0].full_name,
      subjectEmail: traineeRows[0].email,
      generatedFor: reviewerRows[0] ? `by ${reviewerRows[0].full_name}` : undefined,
      rows,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReviewQueue,
  getEvaluationDetail,
  submitReview,
  registerTrainee,
  listTrainees,
  getTraineePerformance,
  removeTrainee,
  exportTraineeRecords,
  listMyDevices,
  assignTraineeDevice,
};
