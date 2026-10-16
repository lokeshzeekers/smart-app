// End-to-end: REAL firmware code (PC build) <-> REAL esp32 routes/controllers <-> in-memory Postgres.
// Usage: node e2e.js <path-to-built-driver>      (needs `npm ci` in ../../../backend)
const path = require('path');
const BACKEND = path.resolve(__dirname, '../../../backend');
const { PGlite } = require(path.join(BACKEND, 'node_modules/@electric-sql/pglite'));
const express = require(path.join(BACKEND, 'node_modules/express'));
const bcrypt = require(path.join(BACKEND, 'node_modules/bcryptjs'));
const fs = require('fs');
const { spawn } = require('child_process');
const assert = require('assert');

(async () => {
  const pg = new PGlite();
  const q = async (t, p) => (await pg.query(t, p)).rows;
  await pg.exec(fs.readFileSync(BACKEND + '/db/schema.sql', 'utf8').replace(/CREATE EXTENSION[^;]*;/, ''));
  await pg.exec(fs.readFileSync(BACKEND + '/db/seed.sql', 'utf8'));
  require.cache[require.resolve(BACKEND + '/src/config/db.js')] = {
    id: 'x', filename: 'x', loaded: true,
    exports: { query: (t, p) => pg.query(t, p), getClient: async () => ({ query: (t, p) => pg.query(t, p), release() {} }) },
  };
  const inst = (await q('select id from institutions limit 1'))[0].id;
  const trainer = (await q(`insert into users(email,full_name,role,institution_id) values('tr@x','Trainer','trainer',$1) returning id`, [inst]))[0].id;
  const trainee = (await q(`insert into users(email,full_name,role,institution_id,trainer_id) values('t@x','Trainee','trainee',$1,$2) returning id`, [inst, trainer]))[0].id;
  const dev = (await q(`insert into devices(device_uid,label,api_key_hash,institution_id) values('SMART-TEST0001','Bench manikin',$1,$2) returning id`, [await bcrypt.hash('test-device-key-123', 4), inst]))[0].id;
  const sid = (await q(`insert into sessions(trainee_id,institution_id,mode,device_id) values($1,$2,'check',$3) returning id`, [trainee, inst, dev]))[0].id;

  const ioEvents = [];
  const io = { to() { return { emit: (e, p) => ioEvents.push([e, p]) }; } };
  const app = express();
  app.use(express.json());
  app.set('io', io);
  app.use('/api/esp32', require(BACKEND + '/src/routes/esp32Routes.js'));
  app.use((err, req, res, next) => { console.error('SERVER ERROR', err.message); res.status(500).json({ error: err.message }); });
  const server = app.listen(4100);

  const child = spawn(process.argv[2], [], { stdio: ['ignore', 'pipe', 'inherit'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const code = await new Promise((r) => child.on('exit', r));
  server.close();
  console.log('--- firmware log (ms since boot) ---\n' + out.split('\n').filter((l) => /BUZZER|alert|session|complete|driver|SMArT/.test(l)).join('\n'));

  console.log('\n--- backend result ---');
  const steps = await q(`select step_no, inferred from session_step_events where session_id=$1 order by step_no`, [sid]);
  console.log('steps credited:', steps.map((s) => s.step_no + (s.inferred ? '*' : '')).join(' '), ' (* = assumed)');
  const alerts = (await q(`select kind from session_alerts where session_id=$1 order by created_at, id`, [sid])).map((a) => a.kind);
  console.log('alerts:', alerts.join(', '));
  const s = (await q(`select status, completed_at is not null as done, laryngoscope_entered_at is not null as lstart, intubation_completed_at is not null as lend from sessions where id=$1`, [sid]))[0];
  const m = (await q(`select total_time_to_intubate, steps_passed from session_metrics where session_id=$1`, [sid]))[0];
  const ev = (await q(`select smart_score, ai_suggestion from evaluations where session_id=$1`, [sid]))[0];
  console.log('session:', JSON.stringify(s), '| metrics:', JSON.stringify(m), '| evaluation:', JSON.stringify(ev));

  // The attempt must have gone exactly as scripted
  assert.strictEqual(code, 0, 'firmware driver did not finish the attempt');
  assert.deepStrictEqual(steps.map((x) => x.step_no), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'all 11 steps credited');
  assert.deepStrictEqual(steps.filter((x) => x.inferred).map((x) => x.step_no), [1, 4, 5, 7, 8], 'assumed steps are exactly 1,4,5,7,8');
  assert.deepStrictEqual(alerts, ['wrong_path', 'correct_path', 'end_point', 'process_complete'], 'alerts fired in order');
  assert.ok(s.done && s.lstart && s.lend && s.status === 'completed', 'session closed with the timer started and stopped');
  assert.ok(Number(m.total_time_to_intubate) > 0 && m.steps_passed === 11, 'metrics stored');
  assert.strictEqual(ev.ai_suggestion, 'pass');
  const banners = new Set(ioEvents.filter((e) => e[0] === 'telemetry:update').map((e) => e[1].bannerMsg));
  assert.ok(banners.has('WRONG PATH - FOOD PIPE') && banners.has('PROCEDURE COMPLETE'), 'banners shown');
  console.log('\nE2E PASSED');
  process.exit(0);
})().catch((e) => { console.error('E2E FAILED:', e.message || e); process.exit(1); });
