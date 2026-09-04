/**
 * SMArT scoring engine.
 *
 * Takes the fixed metric values captured by the ESP32-instrumented manikin
 * for one session and compares them against the institution's configured
 * thresholds to produce:
 *   - a 0-10 smart_score
 *   - an ai_suggestion: 'pass' | 'bad_technique' | 'fail'
 *   - human-readable ai_notes (matches the style seen on the trainer dashboard,
 *     e.g. "Rushed, excess pressure on teeth")
 *
 * This is deliberately deterministic/rule-based (not a black box) so trainers
 * can trust and override it - it is a *suggestion*, final say stays with the trainer.
 */

function classifySession(metrics, thresholds) {
  const notes = [];
  let violations = 0;
  let hardFail = false;

  const {
    laryngoscope_lift_force,
    time_to_place_ett,
    ett_location_cm,
    total_time_to_intubate,
    steps_passed,
    steps_total,
  } = metrics;

  const {
    max_lift_force_psi,
    max_time_to_place_ett_sec,
    max_ett_location_offset_cm,
    max_total_time_sec,
    min_steps_passed,
  } = thresholds;

  // Excess force on airway / teeth
  if (laryngoscope_lift_force > max_lift_force_psi) {
    violations += 1;
    notes.push('Excess force on airway');
  }

  // ETT placement precision
  if (Math.abs(ett_location_cm) > max_ett_location_offset_cm) {
    violations += 1;
    notes.push('Variability in ET tube tip placement');
  }

  // Speed of placement
  if (time_to_place_ett > max_time_to_place_ett_sec) {
    violations += 1;
    notes.push('Rushed or delayed tube placement');
  }

  // Total procedure time
  if (total_time_to_intubate > max_total_time_sec) {
    violations += 1;
    notes.push('Slow overall intubation time');
  }

  // Missed steps - a hard signal, not just a technique issue
  if (steps_passed < min_steps_passed) {
    hardFail = steps_passed <= Math.floor(steps_total * 0.6);
    notes.push(`Only ${steps_passed}/${steps_total} steps completed correctly`);
  }

  // --- Score (0-10): start at 10, deduct for each violation + missed steps ---
  const missedSteps = steps_total - steps_passed;
  let score = 10 - violations - missedSteps;
  score = Math.max(0, Math.min(10, Math.round(score)));

  // --- Suggestion ---
  let suggestion;
  if (hardFail || steps_passed <= Math.floor(steps_total * 0.6)) {
    suggestion = 'fail';
  } else if (violations >= 2 || steps_passed < steps_total) {
    suggestion = 'bad_technique';
  } else if (violations === 1) {
    suggestion = 'bad_technique';
  } else {
    suggestion = 'pass';
  }

  return {
    score,
    suggestion,
    notes: notes.join(', ') || null,
  };
}

module.exports = { classifySession };
