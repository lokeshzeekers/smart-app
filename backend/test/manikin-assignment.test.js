// Which trainee may use which manikin, and the one-live-session-per-manikin rule.
const test = require('node:test');
const assert = require('node:assert/strict');
const { BACKEND, createDb, fakeRes } = require('./helpers');

let q, startSession, listDevices, ids;

test.before(async () => {
  ({ q } = await createDb());
  ({ startSession, listDevices } = require(`${BACKEND}/src/controllers/traineeController.js`));
  const inst = (await q('select id from institutions limit 1'))[0].id;
  const user = async (email, role, trainer) =>
    (await q(`insert into users(email,full_name,role,institution_id,trainer_id) values($1,$1,$2,$3,$4) returning id`, [email, role, inst, trainer || null]))[0].id;
  const tr1 = await user('tr1@x', 'trainer');
  const tr2 = await user('tr2@x', 'trainer');
  const a = await user('a@x', 'trainee', tr1);
  const b = await user('b@x', 'trainee', tr1);
  const c = await user('c@x', 'trainee', tr2);
  const mkDev = async (uid, trainer) =>
    (await q(`insert into devices(device_uid,label,api_key_hash,assigned_trainer_id) values($1,$1,'h',$2) returning id`, [uid, trainer || null]))[0].id;
  ids = { inst, a, b, c, ofTr1: await mkDev('OF-TR1', tr1), shared: await mkDev('SHARED') };
});

const start = async (userId, mode, deviceId) => {
  const res = fakeRes();
  await startSession({ user: { id: userId, institutionId: ids.inst }, body: { mode, deviceId } }, res, (e) => { throw e; });
  return res;
};

test("a trainee can use their own trainer's manikin and a shared one", async () => {
  assert.equal((await start(ids.a, 'check', ids.ofTr1)).code, 201);
  assert.equal((await start(ids.c, 'check', ids.shared)).code, 201);
});

test("a trainee cannot use another trainer's manikin", async () => {
  const res = await start(ids.c, 'coach', ids.ofTr1);
  assert.equal(res.code, 400);
  assert.match(res.out.error, /not available/);
});

test('starting a session closes the previous open session on that manikin', async () => {
  await start(ids.b, 'coach', ids.ofTr1);
  const a = (await q(`select status from sessions where trainee_id = $1`, [ids.a]))[0];
  assert.equal(a.status, 'abandoned');
  const open = (await q(`select count(*)::int n from sessions where device_id = $1 and completed_at is null`, [ids.ofTr1]))[0].n;
  assert.equal(open, 1);
});

test("a trainee pinned to a manikin always gets it, whatever the phone sends", async () => {
  await q(`update users set assigned_device_id = $1 where id = $2`, [ids.ofTr1, ids.b]);
  const res = await start(ids.b, 'check', 'some-other-id');
  assert.ok([200, 201].includes(res.code));
  assert.equal(res.out.session.device_id, ids.ofTr1);
  const list = fakeRes();
  await listDevices({ user: { id: ids.b } }, list, (e) => { throw e; });
  assert.equal(list.out.locked, true);
  assert.equal(list.out.devices.length, 1);
});

test('the device list reports whether each manikin is online', async () => {
  await q(`update devices set last_seen_at = now() where id = $1`, [ids.shared]);
  const list = fakeRes();
  await listDevices({ user: { id: ids.c } }, list, (e) => { throw e; });
  const shared = list.out.devices.find((d) => d.id === ids.shared);
  assert.equal(shared.online, true);
});
