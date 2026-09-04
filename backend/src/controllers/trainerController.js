const db = require('../config/db');

/**
 * "SMArT Score for Review" list, filterable by institution tab.
 * Returns each trainee's latest evaluation with AI suggestion + notes,
 * matching the trainer dashboard mock exactly.
 */
async function getReviewQueue(req, res, next) {
  try {
    const { institutionCode } = req.query;

    const params = [];
    let institutionFilter = '';
    if (institutionCode) {
      params.push(institutionCode);
      institutionFilter = `AND inst.short_code = $${params.length}`;
    }

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
          s.mode,
          inst.short_code AS institution_code
       FROM evaluations e
       JOIN sessions s ON s.id = e.session_id
       JOIN users u ON u.id = s.trainee_id
       LEFT JOIN institutions inst ON inst.id = s.institution_id
       LEFT JOIN session_metrics sm ON sm.session_id = s.id
       WHERE e.review_status = 'pending' ${institutionFilter}
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

module.exports = { getReviewQueue, getEvaluationDetail, submitReview };
