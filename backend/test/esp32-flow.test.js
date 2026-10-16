// The manikin -> backend flow: steps, alerts, timer, completion, and device ownership.
const test = require('node:test');
const assert = require('node:assert/strict');
const { BACKEND, createDb, fakeRes } = require('./helpers');

let q, esp, router, ids;

test.before(async () => {
  ({ q } = await createDb());
  esp = require(`${BACKEND}/src/controllers/esp32Controller.js`);
  router = require(`${BACKEND}/src/routes/esp32Routes.js`);
  const inst = (await q('select id from institutions limit 1'))[0].id;
  const user = async (email, role) =>
    (await q(`insert into users(email,full_name,role,institution_id) values($1,$1,$2,$3) returning id`, [email, role, inst]))[0].id;
  const trainee = await user('t@x', 'trainee');
  const mkDev = async (uid) => (await q(`insert into devices(device_uid,label,api_key_hash) values($1,$1,'h') returning id`, [uid]))[0].id;
  const dev1 = await mkDev('S1');
  const dev2 = await mkDev('S2');
  const sess = async (dev) =>
    (await q(`insert into sessions(trainee_id,institution_id,mode,device_id) values($1,$2,'check',$3) returning id`, [trainee, inst, dev]))[0].id;
  ids = { inst, trainee, dev1, dev2, s1: await sess(dev1) };
});

const call = async (fn, sessionId, body, device = ids.dev1) => {
  const io = { events: [], to() { return { emit: (e, p) => io.events.push([e, p]) }; } };
  const res = fakeRes();
  await fn({ params: { sessionId }, body, app: { get: () => io }, device: { id: device } }, res, (e) => { throw e; });
  return { res, io };
};

test('the steps table matches the physical sequence (10 = insert ETT, 11 = remove stylet)', async () => {
  const rows = await q('select step_no, title from procedure_steps where step_no in (10, 11) order by 1');
  assert.match(rows[0].title, /^Insert ETT/);
  assert.equal(rows[1].title, 'Remove stylet');
});

test('stepNo is validated', async () => {
  for (const bad of [0, 12, 99, 'x', null, 1.5]) {
    const { res } = await call(esp.pushStepEvent, ids.s1, { stepNo: bad });
    assert.equal(res.code, 400, `stepNo ${bad} must be rejected`);
  }
});

test('"assumed" steps are never upgraded wrongly: a sensed step is not downgraded', async () => {
  let { res } = await call(esp.pushStepEvent, ids.s1, { stepNo: 4, inferred: true });
  assert.equal(res.out.event.inferred, true);
  ({ res } = await call(esp.pushStepEvent, ids.s1, { stepNo: 4, inferred: false }));
  assert.equal(res.out.event.inferred, false, 'a real sensor reading replaces the assumption');
  ({ res } = await call(esp.pushStepEvent, ids.s1, { stepNo: 4, inferred: true }));
  assert.equal(res.out.event.inferred, false, 'a later assumption must not downgrade it');
});

test('laryngoscope timer starts on entry, stops at depth, and alerts are stored', async () => {
  await call(esp.pushTelemetry, ids.s1, { laryngoscopePresent: false, bannerType: 'progress' });
  let { io } = await call(esp.pushTelemetry, ids.s1, { laryngoscopePresent: true, bannerType: 'progress' });
  let t = io.events.find((e) => e[0] === 'telemetry:update')[1];
  assert.equal(t.timerRunning, true);
  await new Promise((r) => setTimeout(r, 1100));
  ({ io } = await call(esp.pushTelemetry, ids.s1, { laryngoscopePresent: true, bannerType: 'progress', alertEvent: 'head_position' }));
  ({ io } = await call(esp.pushTelemetry, ids.s1, { laryngoscopePresent: true, bannerType: 'complete', alertEvent: 'end_point' }));
  t = io.events.find((e) => e[0] === 'telemetry:update')[1];
  assert.equal(t.timerRunning, false, 'timer stops when the tube is at the designated depth');
  assert.ok(t.laryngoscopeElapsedMs >= 1000);
  const kinds = (await q('select kind from session_alerts where session_id = $1 order by created_at', [ids.s1])).map((r) => r.kind);
  assert.deepEqual(kinds, ['head_position', 'end_point']);
  assert.ok(io.events.some((e) => e[0] === 'alert:new'), 'alert is pushed live to the phone');
});

test('unknown alert names are ignored, not stored', async () => {
  await call(esp.pushTelemetry, ids.s1, { alertEvent: 'drop_table' });
  const n = (await q(`select count(*)::int n from session_alerts where session_id = $1`, [ids.s1]))[0].n;
  assert.equal(n, 2);
});

test('/complete with an empty body stores the measured time and closes the session', async () => {
  const { res } = await call(esp.completeSession, ids.s1, {});
  assert.equal(res.code, 200);
  assert.ok(Number(res.out.metrics.total_time_to_intubate) >= 1, 'server-measured total time is used');
  const s = (await q('select status, completed_at from sessions where id = $1', [ids.s1]))[0];
  assert.equal(s.status, 'completed');
  assert.ok(s.completed_at);
});

test('a manikin may only write into an OPEN session that was started on it', async () => {
  const open = (await q(`insert into sessions(trainee_id,institution_id,mode,device_id) values($1,$2,'check',$3) returning id`, [ids.trainee, ids.inst, ids.dev2]))[0].id;
  const guard = router.params.sessionId[0];
  const check = async (sessionId, device) => {
    const res = fakeRes();
    let nexted = false;
    await guard({ device: { id: device } }, res, () => { nexted = true; }, sessionId);
    return nexted ? 'allowed' : res.code;
  };
  assert.equal(await check(open, ids.dev2), 'allowed');
  assert.equal(await check(open, ids.dev1), 409, "another manikin's session");
  assert.equal(await check(ids.s1, ids.dev1), 409, 'a completed session');
  assert.equal(await check('not-a-uuid; drop table', ids.dev1), 404, 'junk id');
});
