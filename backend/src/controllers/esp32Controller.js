const db = require('../config/db');
const { classifySession } = require('../utils/scoring');

/**
 * Called by the ESP32 firmware in real time as the trainee moves through
 * the manikin, e.g. once per completed step:
 *   POST /api/esp32/sessions/:sessionId/steps
 *   { "stepNo": 7, "metricValue": 22 }
 *
 * Pushes a socket.io event so the Coach/Check screens light up the dot live.
 */
async function pushStepEvent(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { stepNo, metricValue } = req.body;

    if (!stepNo) return res.status(400).json({ error: 'stepNo is required' });

    const { rows } = await db.query(
      `INSERT INTO session_step_events (session_id, step_no, completed, metric_value)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (session_id, step_no)
       DO UPDATE SET completed = true, metric_value = $3, recorded_at = now()
       RETURNING *`,
      [sessionId, stepNo, metricValue ?? null]
    );

    const io = req.app.get('io');
    io.to(`session:${sessionId}`).emit('step:update', rows[0]);

    res.status(201).json({ event: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * Called by the ESP32 once the trial finishes with the four fixed summary
 * metrics (matches the Check / Certification screens exactly):
 *   POST /api/esp32/sessions/:sessionId/complete
 *   {
 *     "laryngoscopeLiftForce": 22,
 *     "timeToPlaceEtt": 2.18,
 *     "ettLocationCm": -1,
 *     "totalTimeToIntubate": 62
 *   }
 *
 * This closes the session, stores the metrics, runs the auto-classification
 * engine, and (for check/certification modes) creates a pending evaluation
 * that appears in the trainer's review queue.
 */
async function completeSession(req, res, next) {
  const client = await db.getClient();
  try {
    const { sessionId } = req.params;
    const {
      laryngoscopeLiftForce,
      timeToPlaceEtt,
      ettLocationCm,
      totalTimeToIntubate,
    } = req.body;

    await client.query('BEGIN');

    const { rows: sessionRows } = await client.query(
      `SELECT * FROM sessions WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );
    if (sessionRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionRows[0];

    const { rows: stepRows } = await client.query(
      `SELECT count(*)::int AS passed FROM session_step_events
       WHERE session_id = $1 AND completed = true`,
      [sessionId]
    );
    const stepsPassed = stepRows[0].passed;

    const { rows: metricRows } = await client.query(
      `INSERT INTO session_metrics
        (session_id, laryngoscope_lift_force, time_to_place_ett, ett_location_cm,
         total_time_to_intubate, steps_passed, steps_total)
       VALUES ($1,$2,$3,$4,$5,$6,11)
       ON CONFLICT (session_id) DO UPDATE SET
         laryngoscope_lift_force = $2, time_to_place_ett = $3, ett_location_cm = $4,
         total_time_to_intubate = $5, steps_passed = $6
       RETURNING *`,
      [sessionId, laryngoscopeLiftForce, timeToPlaceEtt, ettLocationCm, totalTimeToIntubate, stepsPassed]
    );
    const metrics = metricRows[0];

    await client.query(
      `UPDATE sessions SET status = 'completed', completed_at = now() WHERE id = $1`,
      [sessionId]
    );

    // Look up institution-specific thresholds, falling back to global defaults
    const { rows: thresholdRows } = await client.query(
      `SELECT * FROM scoring_thresholds
       WHERE institution_id = $1
       UNION ALL
       SELECT * FROM scoring_thresholds WHERE institution_id IS NULL
       LIMIT 1`,
      [session.institution_id]
    );
    const thresholds = thresholdRows[0];

    let evaluation = null;
    if (session.mode !== 'coach') {
      const { score, suggestion, notes } = classifySession(metrics, thresholds);

      const { rows: evalRows } = await client.query(
        `INSERT INTO evaluations (session_id, smart_score, ai_suggestion, ai_notes)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (session_id) DO UPDATE SET
           smart_score = $2, ai_suggestion = $3, ai_notes = $4
         RETURNING *`,
        [sessionId, score, suggestion, notes]
      );
      evaluation = evalRows[0];

      // notify trainers of this institution
      const { rows: trainers } = await client.query(
        `SELECT id FROM users WHERE role = 'trainer' AND institution_id = $1`,
        [session.institution_id]
      );
      for (const t of trainers) {
        await client.query(
          `INSERT INTO notifications (user_id, title, body)
           VALUES ($1, $2, $3)`,
          [t.id, 'New submission for review', `A trainee scored ${score}/10 (${suggestion.replace('_',' ')})`]
        );
      }
    }

    await client.query('COMMIT');

    const io = req.app.get('io');
    io.to(`session:${sessionId}`).emit('session:complete', { metrics, evaluation });
    if (evaluation) io.to('trainers').emit('review:new', evaluation);

    res.json({ session: { ...session, status: 'completed' }, metrics, evaluation });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { pushStepEvent, completeSession };
