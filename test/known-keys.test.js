// Automated checks for the "--known-keys" snapshot mode (scripts/snapshot.js).
// Run them with:  npm test
//
// What these protect (in plain words):
//   - this mode can only ask Upstash to GET or HGETALL one known key, as a plain read request;
//   - it can never use SCAN or KEYS, and it can never send anything that changes data;
//   - it works with the Read-Only token (imitated by the fake server) where the SCAN mode cannot;
//   - the normal SCAN snapshot is untouched;
//   - it never prints the credentials, and it says clearly what it did NOT check.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startFakeUpstash, FAKE_TOKEN, FAKE_READONLY_TOKEN } from '../test-helpers/fake-upstash.js';
import { sendReadsToUpstash, sendToUpstash } from '../lib/upstash.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { snapshotRunner, takeKnownKeysSnapshot, takeSnapshot, describe, knownKeyNames, KNOWN_KEYS_COMMANDS } = await import('../scripts/snapshot.js');
const { QUESTIONS, DRINK_FIELDS, COMPARE_QUESTIONS } = await import('../public/js/schema.js');

const PROD = 'boba:v1';
const WRITE_AND_BROAD = ['SET', 'DEL', 'UNLINK', 'INCR', 'DECR', 'HINCRBY', 'HSET', 'EXPIRE', 'FLUSHALL', 'FLUSHDB', 'EVAL', 'SCAN', 'KEYS', 'DBSIZE', 'TYPE', 'TTL', 'RENAME', 'APPEND'];

function seed(fake) {
  fake.data.set(`${PROD}:total`, 5);
  fake.data.set(`${PROD}:drinks`, 2);
  fake.data.set(`${PROD}:q:adventure`, { try: 3, ask: 2 });
  fake.data.set(`${PROD}:q:sweetness`, { '50': 5 });
  fake.data.set(`${PROD}:x:adventure`, { 'europe|try': 2 });
  fake.data.set(`${PROD}:drink:tea`, { oolong: 2 });
  fake.data.set(`${PROD}:rl:0123456789abcdef0123456789abcdef`, 4); // a counter this mode cannot see
  fake.data.set(`${PROD}:stray`, 'unknown');                         // a stray key this mode cannot see
  fake.data.set('boba-preview:x:v1:total', 99);                      // someone else's data
}

async function withFake(fn) {
  const fake = await startFakeUpstash();
  try { await fn(fake); } finally { await fake.close(); }
}
const readOnly = (fake) => ({ url: fake.url, token: FAKE_READONLY_TOKEN });
const knownRun = (fake) => snapshotRunner((commands) => sendReadsToUpstash(readOnly(fake), commands), PROD, 'production', 'known-keys');

function runScript(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, 'scripts', 'snapshot.js'), ...args], { cwd: root, env: { PATH: process.env.PATH, ...env } });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

test('the fake server imitates the Read-Only token: plain reads work, SCAN and /pipeline get 401', async () => {
  await withFake(async (fake) => {
    seed(fake);
    const auth = { Authorization: `Bearer ${FAKE_READONLY_TOKEN}` };
    assert.equal(Number((await (await fetch(`${fake.url}/get/${PROD}:total`, { headers: auth })).json()).result), 5);
    const pipeline = await fetch(`${fake.url}/pipeline`, { method: 'POST', headers: auth, body: JSON.stringify([['GET', `${PROD}:total`]]) });
    assert.equal(pipeline.status, 401);
    // This is what happened to the user: the normal snapshot fails with the Read-Only token.
    await assert.rejects(() => takeSnapshot(snapshotRunner((c) => sendToUpstash(readOnly(fake), c), PROD, 'production'), PROD, 'production'), /401/);
  });
});

test('the list of known keys comes from the website schema and stays inside boba:v1:', () => {
  const names = knownKeyNames();
  assert.equal(names.length, 2 + QUESTIONS.length + Object.keys(DRINK_FIELDS).length + COMPARE_QUESTIONS.length);
  assert.equal(new Set(names).size, names.length, 'no duplicates');
  assert.ok(names.includes('total') && names.includes('drinks'));
  for (const name of names) assert.match(`${PROD}:${name}`, /^boba:v1:[A-Za-z0-9:|._-]+$/);
  assert.deepEqual([...KNOWN_KEYS_COMMANDS].sort(), ['GET', 'HGETALL']);
});

test('known-keys snapshot works with the Read-Only token and reports the real counters', async () => {
  await withFake(async (fake) => {
    seed(fake);
    const snapshot = await takeKnownKeysSnapshot(knownRun(fake), PROD, 'production');
    assert.equal(snapshot.mode, 'known-keys');
    assert.equal(snapshot.total, 5);
    assert.equal(snapshot.drinksTotal, 2);
    assert.deepEqual(snapshot.answers.adventure, { try: 3, ask: 2 });
    assert.deepEqual(snapshot.regional.adventure, { 'europe|try': 2 });
    assert.deepEqual(snapshot.drinkParts.tea, { oolong: 2 });
    assert.equal(snapshot.keysInNamespace, 6, 'the six known counters that exist');
    // What it cannot know is marked "not checked", never reported as zero.
    assert.equal(snapshot.rateLimitCounters, null);
    assert.equal(snapshot.unknownKeys, null);
    assert.equal(snapshot.keysInDatabase, null);
    // It never sees someone else's data.
    assert.equal(JSON.stringify(snapshot).includes('99'), false);
  });
});

test('known-keys mode sends only plain GET requests to /get/ and /hgetall/, with no body', async () => {
  await withFake(async (fake) => {
    seed(fake);
    const before = fake.slice('');
    fake.requests.length = 0;
    await takeKnownKeysSnapshot(knownRun(fake), PROD, 'production');
    assert.equal(fake.requests.length, knownKeyNames().length);
    for (const request of fake.requests) {
      assert.equal(request.method, 'GET');
      assert.equal(request.hadBody, false);
      assert.match(request.path, /^\/(get|hgetall)\/boba%3Av1%3A/, request.path);
    }
    assert.equal(fake.requests.some((r) => /scan|keys|pipeline|set|del|incr|expire|flush/i.test(r.path.replace(/^\/(get|hgetall)\//, '').replace(/boba%3Av1%3A[\w%|.\-]*/g, ''))), false);
    assert.equal(fake.slice(''), before, 'nothing in the database changed');
  });
});

test('known-keys mode cannot issue write or broad commands: the safety belt refuses them before sending', async () => {
  await withFake(async (fake) => {
    seed(fake);
    fake.requests.length = 0;
    const run = knownRun(fake);
    for (const command of WRITE_AND_BROAD) {
      await assert.rejects(() => run([['GET', `${PROD}:total`], [command, `${PROD}:total`]]), /Refused/, command);
      await assert.rejects(() => run([[command.toLowerCase(), `${PROD}:total`, '1']]), /Refused/, command);
    }
    await assert.rejects(() => run([['SCAN', '0', 'MATCH', `${PROD}:*`]]), /Refused/);
    await assert.rejects(() => run([['KEYS', `${PROD}:*`]]), /Refused/);
    await assert.rejects(() => run([['GET', 'someone-elses-key']]), /Refused/);
    await assert.rejects(() => run([['GET', 'boba-preview:x:v1:total']]), /Refused/);
    await assert.rejects(() => run([['GET', 'boba:v1']]), /Refused/);
    assert.equal(fake.requests.length, 0, 'nothing was sent for any refused batch');
  });
});

test('even without the safety belt, the GET-only sender cannot express anything but GET and HGETALL', async () => {
  await withFake(async (fake) => {
    seed(fake);
    const before = fake.slice('');
    fake.requests.length = 0;
    const config = readOnly(fake);
    for (const command of WRITE_AND_BROAD) {
      await assert.rejects(() => sendReadsToUpstash(config, [[command, `${PROD}:total`]]), /Refused/, command);
    }
    for (const bad of [[], ['GET'], ['GET', 'a', 'b'], ['GET', 5], 'GET', null, ['HGETALL', ['x']], [['GET'], 'x']]) {
      await assert.rejects(() => sendReadsToUpstash(config, [bad]), /Refused/, JSON.stringify(bad));
    }
    // A bad command later in the batch must not let the earlier good ones through half-way... they are only reads,
    // but the batch is still refused as a whole before the bad one is sent.
    assert.equal(fake.requests.filter((r) => !/^\/(get|hgetall)\//.test(r.path)).length, 0);
    assert.equal(fake.slice(''), before);
    // Even a key that tries to smuggle a path or a command stays one harmless, encoded key name.
    const tricky = await sendReadsToUpstash(config, [['GET', `${PROD}:total/../flushall`]]);
    assert.deepEqual(tricky, [null]);
    assert.ok(fake.requests.every((r) => r.method === 'GET'));
    assert.equal(fake.slice(''), before);
  });
});

test('a wrong token or a server error stops the known-keys snapshot with a clear message and no secret', async () => {
  await withFake(async (fake) => {
    seed(fake);
    await assert.rejects(() => sendReadsToUpstash({ url: fake.url, token: 'wrong' }, [['GET', `${PROD}:total`]]), /401/);
    fake.state.failAll = true;
    await assert.rejects(() => sendReadsToUpstash(readOnly(fake), [['GET', `${PROD}:total`]]), /500/);
  });
});

test('the known-keys report says what it did NOT check and refuses to approve a reset', async () => {
  await withFake(async (fake) => {
    seed(fake);
    const snapshot = await takeKnownKeysSnapshot(knownRun(fake), PROD, 'production');
    const text = describe(snapshot, 5);
    assert.match(text, /KNOWN KEYS ONLY/);
    assert.match(text, /NOT checked/);
    assert.match(text, /NOT enough to approve a reset/);
    assert.doesNotMatch(text, /You can approve the reset/);
    assert.match(text, /MATCH/i);
    assert.match(describe(snapshot, 7), /MISMATCH|DIFFER|do not match|does not match/i);
  });
});

test('the program: --known-keys works with the Read-Only token, changes nothing and prints no credentials', async () => {
  await withFake(async (fake) => {
    seed(fake);
    const before = fake.slice('');
    const env = { UPSTASH_REDIS_REST_URL: fake.url, UPSTASH_REDIS_REST_TOKEN: FAKE_READONLY_TOKEN };
    fake.requests.length = 0;
    const result = await runScript(['--production', '--known-keys', '--expect', '5'], env);
    assert.equal(result.code, 0, result.err);
    assert.match(result.out, /KNOWN KEYS ONLY/);
    assert.match(result.out, /NOT enough to approve a reset/);
    assert.equal(result.out.includes(fake.url) || result.out.includes(FAKE_READONLY_TOKEN) || result.err.includes(FAKE_READONLY_TOKEN), false);
    assert.ok(fake.requests.length > 0 && fake.requests.every((r) => r.method === 'GET' && !r.hadBody && /^\/(get|hgetall)\//.test(r.path)));
    assert.equal(fake.slice(''), before, 'the database is exactly as it was');

    // The normal mode keeps working with the full token...
    const normal = await runScript(['--production', '--expect', '5'], { UPSTASH_REDIS_REST_URL: fake.url, UPSTASH_REDIS_REST_TOKEN: FAKE_TOKEN });
    assert.equal(normal.code, 0, normal.err);
    assert.doesNotMatch(normal.out, /KNOWN KEYS ONLY/);
    assert.match(normal.out, /rate-limit counters/);
    // ...and still fails with the Read-Only token, exactly as the user saw.
    const failing = await runScript(['--production'], env);
    assert.equal(failing.code, 1);
    assert.match(failing.err, /401/);
    assert.equal(fake.slice(''), before);
  });
});
