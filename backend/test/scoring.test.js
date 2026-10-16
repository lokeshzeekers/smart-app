const test = require('node:test');
const assert = require('node:assert/strict');
const { classifySession } = require('../src/utils/scoring');

const thresholds = { max_lift_force_psi: 22, max_time_to_place_ett_sec: 2.5, max_ett_location_offset_cm: 1, max_total_time_sec: 70, min_steps_passed: 10 };
const good = { laryngoscope_lift_force: 15, time_to_place_ett: 2, ett_location_cm: 0.5, total_time_to_intubate: 60, steps_passed: 11, steps_total: 11 };

test('a clean attempt passes with 10/10', () => {
  const r = classifySession(good, thresholds);
  assert.equal(r.suggestion, 'pass');
  assert.equal(r.score, 10);
});

test('metrics the manikin does not measure are ignored, not treated as violations', () => {
  const r = classifySession({ ...good, laryngoscope_lift_force: null, time_to_place_ett: null, ett_location_cm: null }, thresholds);
  assert.equal(r.suggestion, 'pass');
  assert.equal(r.notes, null);
});

test('a slow attempt is flagged', () => {
  const r = classifySession({ ...good, total_time_to_intubate: 90 }, thresholds);
  assert.equal(r.suggestion, 'bad_technique');
  assert.match(r.notes, /Slow overall/);
});

test('too few steps fails', () => {
  const r = classifySession({ ...good, steps_passed: 5 }, thresholds);
  assert.equal(r.suggestion, 'fail');
});
